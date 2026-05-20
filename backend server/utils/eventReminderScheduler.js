const { query } = require('../config/db');
const { createNotification } = require('../controllers/notificationController');

const SCHEDULER_INTERVAL_MS = 1000;

const formatReminderContent = (eventTitle) => {
  return `Event "${eventTitle}" is starting now.`;
};

const dispatchDueEventReminders = async (io) => {
  const dueReminders = await query(
    `SELECT er.id AS reminderId, er.event_id AS eventId, er.user_id AS userId,
            e.title AS eventTitle, e.date AS eventDate, e.created_by AS creatorId
       FROM event_reminders er
       JOIN events e ON e.id = er.event_id
      WHERE er.sent_at IS NULL
        AND e.date <= CURRENT_TIMESTAMP
        AND er.created_at <= e.date
      ORDER BY e.date ASC, er.id ASC
      LIMIT 100`
  );

  for (const reminder of dueReminders) {
    const notification = await createNotification(
      reminder.userId,
      reminder.creatorId,
      'EVENT_REMINDER',
      null,
      null,
      null,
      {
        allowSelf: true,
        content: formatReminderContent(reminder.eventTitle)
      }
    );

    if (notification && io) {
      io.to(`user:${String(reminder.userId)}`).emit('new_notification', notification);
    }

    await query('UPDATE event_reminders SET sent_at = CURRENT_TIMESTAMP WHERE id = $1', [reminder.reminderId]);
  }
};

const autoDeleteExpiredEvents = async (io) => {
  try {
    // Select events that started more than 1 hour ago
    const expiredEvents = await query(
      `SELECT id, title FROM events WHERE date <= CURRENT_TIMESTAMP - INTERVAL '1 HOUR'`
    );

    for (const event of expiredEvents) {
      // 1. Delete associated notifications
      await query(
        "DELETE FROM notifications WHERE type = 'EVENT_REMINDER' AND content = $1",
        [formatReminderContent(event.title)]
      );

      // 2. Delete the event itself (cascading deletes event_attendees and event_reminders automatically)
      await query('DELETE FROM events WHERE id = $1', [event.id]);

      // 3. Emit live socket events to update client UI instantly
      if (io) {
        io.emit('event-deleted', event.id);
        io.emit('event-notifications-deleted', {
          type: 'EVENT_REMINDER',
          content: formatReminderContent(event.title)
        });
      }
      console.log(`[EventReminderScheduler] Auto-deleted expired event: "${event.title}" (ID: ${event.id})`);
    }
  } catch (error) {
    console.error('[EventReminderScheduler] Auto-delete expired events error:', error);
  }
};

const startEventReminderScheduler = (io) => {
  const tick = () => {
    dispatchDueEventReminders(io).catch((error) => {
      console.error('[EventReminderScheduler] Tick error:', error);
    });
    autoDeleteExpiredEvents(io).catch((error) => {
      console.error('[EventReminderScheduler] Auto-delete error:', error);
    });
  };

  tick();
  return setInterval(tick, SCHEDULER_INTERVAL_MS);
};

module.exports = { startEventReminderScheduler };