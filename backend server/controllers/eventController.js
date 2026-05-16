const { query } = require('../config/db');
const { createNotification } = require('./notificationController');

const formatEventDate = (dateValue) => {
  if (dateValue === null || dateValue === undefined || dateValue === '') {
    throw new Error('Event date is required');
  }

  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (localMatch) {
      const [, datePart, hourPart = '00', minutePart = '00', secondPart = '00'] = localMatch;
      return `${datePart} ${hourPart}:${minutePart}:${secondPart}`;
    }
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Invalid event date');
  }

  return parsedDate.toISOString().slice(0, 19).replace('T', ' ');
};

const getReminderFlag = async (eventId, currentUserId) => {
  if (!currentUserId) return false;

  try {
    const reminderRows = await query(
      'SELECT id FROM event_reminders WHERE event_id = ? AND user_id = ? LIMIT 1',
      [eventId, currentUserId]
    );
    return reminderRows.length > 0;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return false;
    }
    throw error;
  }
};

const getFormattedEvent = async (eventId, currentUserId = null) => {
  const rows = await query(
    `SELECT e.id, e.title, e.description, e.date, e.location, e.created_at AS createdAt,
            u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
       FROM events e
       JOIN users u ON u.id = e.created_by
      WHERE e.id = ?
      LIMIT 1`,
    [eventId]
  );

  if (!rows.length) return null;

  const event = rows[0];
  const attendees = await query(
    `SELECT u.id, u.name, u.email, u.profile_picture AS profilePicture
       FROM event_attendees ea
       JOIN users u ON u.id = ea.user_id
      WHERE ea.event_id = ?`,
    [event.id]
  );

  const isReminderSet = await getReminderFlag(event.id, currentUserId);

  return {
    ...event,
    createdBy: { id: event.creatorId, name: event.creatorName, email: event.creatorEmail, profilePicture: event.creatorProfilePicture },
    attendees,
    isReminderSet
  };
};

// @desc    Create a new event (faculty only)
// @route   POST /api/events
// @access  Private/Faculty
const createEvent = async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const currentUserId = req.user.id || req.user._id;

    // Format ISO date to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
    const formattedDate = formatEventDate(date);

    const result = await query(
      'INSERT INTO events (title, description, date, location, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description, formattedDate, location || null, currentUserId]
    );

    const eventId = result.insertId;
    
    const populatedEvent = await getFormattedEvent(eventId, currentUserId);
    
    const io = req.app.get('io');
    if (io) io.emit('new-event', populatedEvent);
    
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all events
// @route   GET /api/events
// @access  Private
const getEvents = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const eventsRows = await query(
      `SELECT e.id, e.title, e.description, e.date, e.location, e.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM events e
         JOIN users u ON u.id = e.created_by
        ORDER BY e.date ASC`
    );

    const events = await Promise.all(eventsRows.map(async (event) => {
      const attendees = await query(
        `SELECT u.id, u.name, u.email, u.profile_picture AS profilePicture
           FROM event_attendees ea
           JOIN users u ON u.id = ea.user_id
          WHERE ea.event_id = ?`,
        [event.id]
      );
      return {
        ...event,
        createdBy: { id: event.creatorId, name: event.creatorName, email: event.creatorEmail, profilePicture: event.creatorProfilePicture },
        attendees,
        isReminderSet: await getReminderFlag(event.id, currentUserId)
      };
    }));
    
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get event by ID
// @route   GET /api/events/:id
// @access  Private
const getEventById = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const event = await getFormattedEvent(req.params.id, currentUserId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update event (faculty only)
// @route   PUT /api/events/:id
// @access  Private/Faculty
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const currentUserId = req.user.id || req.user._id;
    
    const rows = await query('SELECT created_by FROM events WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Event not found' });
    if (String(rows[0].created_by) !== String(currentUserId)) {
      return res.status(403).json({ message: 'User not authorized to update this event' });
    }
    
    // Format ISO date to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
    const formattedDate = formatEventDate(date);
    
    await query(
      'UPDATE events SET title = ?, description = ?, date = ?, location = ? WHERE id = ?',
      [title, description, formattedDate, location || null, req.params.id]
    );
    
    const populatedUpdatedEvent = await getFormattedEvent(req.params.id, currentUserId);

    const io = req.app.get('io');
    if (io) io.emit('event-updated', populatedUpdatedEvent);
    
    res.json(populatedUpdatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete event (faculty only)
// @route   DELETE /api/events/:id
// @access  Private/Faculty
const deleteEvent = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const rows = await query('SELECT created_by FROM events WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Event not found' });
    if (String(rows[0].created_by) !== String(currentUserId)) {
      return res.status(403).json({ message: 'User not authorized to delete this event' });
    }
    
    await query('DELETE FROM events WHERE id = ?', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.emit('event-deleted', req.params.id);
    
    res.json({ message: 'Event removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Attend an event
// @route   PUT /api/events/attend/:id
// @access  Private
const attendEvent = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const eventId = req.params.id;

    const exists = await query('SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ? LIMIT 1', [eventId, currentUserId]);
    if (exists.length) {
      return res.status(400).json({ message: 'Already attending this event' });
    }
    
    await query('INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)', [eventId, currentUserId]);

    const updatedEvent = await getFormattedEvent(eventId, currentUserId);
    const io = req.app.get('io');
    if (io) io.emit('event-attendance-updated', updatedEvent);

    res.json(updatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Unattend an event
// @route   PUT /api/events/unattend/:id
// @access  Private
const unattendEvent = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const eventId = req.params.id;

    await query('DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?', [eventId, currentUserId]);

    const updatedEvent = await getFormattedEvent(eventId, currentUserId);
    const io = req.app.get('io');
    if (io) io.emit('event-attendance-updated', updatedEvent);

    res.json(updatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle reminder for an event
// @route   PUT /api/events/reminder/:id
// @access  Private
const toggleEventReminder = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const eventId = req.params.id;
    const { enabled } = req.body;

    const eventRows = await query('SELECT id, title, date, created_by FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (!eventRows.length) return res.status(404).json({ message: 'Event not found' });

    let existing = [];
    try {
      existing = await query('SELECT id, sent_at FROM event_reminders WHERE event_id = ? AND user_id = ? LIMIT 1', [eventId, currentUserId]);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        return res.json(await getFormattedEvent(eventId, currentUserId));
      }
      throw error;
    }

    const shouldEnable = typeof enabled === 'boolean' ? enabled : existing.length === 0;

    try {
      if (shouldEnable) {
        if (!existing.length) {
          await query('INSERT INTO event_reminders (event_id, user_id) VALUES (?, ?)', [eventId, currentUserId]);
        }
      } else if (existing.length) {
        await query('DELETE FROM event_reminders WHERE event_id = ? AND user_id = ?', [eventId, currentUserId]);
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        return res.json(await getFormattedEvent(eventId, currentUserId));
      }
      throw error;
    }

    const updatedEvent = await getFormattedEvent(eventId, currentUserId);
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${String(currentUserId)}`).emit('event-reminder-updated', {
        eventId,
        isReminderSet: updatedEvent.isReminderSet
      });
    }

    res.json(updatedEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  attendEvent,
  unattendEvent,
  toggleEventReminder,
  getFormattedEvent
};