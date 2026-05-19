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
        AND e.date <= UTC_TIMESTAMP()
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

    await query('UPDATE event_reminders SET sent_at = UTC_TIMESTAMP() WHERE id = ?', [reminder.reminderId]);
  }
};

const startEventReminderScheduler = (io) => {
  const tick = () => {
    dispatchDueEventReminders(io).catch((error) => {
      console.error('[EventReminderScheduler] Tick error:', error);
    });
  };

  tick();
  return setInterval(tick, SCHEDULER_INTERVAL_MS);
};

module.exports = { startEventReminderScheduler };