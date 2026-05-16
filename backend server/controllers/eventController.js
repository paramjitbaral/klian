const { query } = require('../config/db');

// @desc    Create a new event (faculty only)
// @route   POST /api/events
// @access  Private/Faculty
const createEvent = async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const currentUserId = req.user.id || req.user._id;

    // Format ISO date to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
    const formattedDate = new Date(date).toISOString().slice(0, 19).replace('T', ' ');

    const result = await query(
      'INSERT INTO events (title, description, date, location, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description, formattedDate, location || null, currentUserId]
    );

    const eventId = result.insertId;
    
    const rows = await query(
      `SELECT e.id, e.title, e.description, e.date, e.location, e.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM events e
         JOIN users u ON u.id = e.created_by
        WHERE e.id = ?
        LIMIT 1`,
      [eventId]
    );
    
    const populatedEvent = {
      ...rows[0],
      createdBy: { id: rows[0].creatorId, name: rows[0].creatorName, email: rows[0].creatorEmail, profilePicture: rows[0].creatorProfilePicture },
      attendees: []
    };
    
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
        attendees
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
    const rows = await query(
      `SELECT e.id, e.title, e.description, e.date, e.location, e.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM events e
         JOIN users u ON u.id = e.created_by
        WHERE e.id = ?
        LIMIT 1`,
      [req.params.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const event = rows[0];
    const attendees = await query(
      `SELECT u.id, u.name, u.email, u.profile_picture AS profilePicture
         FROM event_attendees ea
         JOIN users u ON u.id = ea.user_id
        WHERE ea.event_id = ?`,
      [event.id]
    );

    res.json({
      ...event,
      createdBy: { id: event.creatorId, name: event.creatorName, email: event.creatorEmail, profilePicture: event.creatorProfilePicture },
      attendees
    });
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
    
    await query(
      'UPDATE events SET title = ?, description = ?, date = ?, location = ? WHERE id = ?',
      [title, description, date, location, req.params.id]
    );
    
    const updated = await query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
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
    
    const attendees = await query(
      `SELECT u.id, u.name, u.email, u.profile_picture AS profilePicture
         FROM event_attendees ea
         JOIN users u ON u.id = ea.user_id
        WHERE ea.event_id = ?`,
      [eventId]
    );
    
    res.json(attendees);
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
    
    const attendees = await query(
      `SELECT u.id, u.name, u.email, u.profile_picture AS profilePicture
         FROM event_attendees ea
         JOIN users u ON u.id = ea.user_id
        WHERE ea.event_id = ?`,
      [eventId]
    );
    
    res.json(attendees);
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
  unattendEvent
};