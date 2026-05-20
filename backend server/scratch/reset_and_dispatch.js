const { query } = require('../config/db');
const { startEventReminderScheduler } = require('../utils/eventReminderScheduler');
require('dotenv').config();

async function run() {
  try {
    console.log('Resetting sent_at to NULL for all event_reminders so they can be processed...');
    await query('UPDATE event_reminders SET sent_at = NULL');
    
    // We will call the scheduler to dispatch
    console.log('Importing and running dispatchDueEventReminders...');
    
    // Let's require the scheduler and mock the 'io' object to trace if emit is called
    const { dispatchDueEventReminders } = require('../utils/eventReminderScheduler');
    
    const mockIo = {
      to: (room) => {
        console.log(`📡 [Mock Socket] Emitting to room: ${room}`);
        return {
          emit: (event, payload) => {
            console.log(`📡 [Mock Socket] Event: "${event}"`);
            console.log('📡 [Mock Socket] Payload:', JSON.stringify(payload, null, 2));
          }
        };
      }
    };
    
    // Run dispatch
    // Wait a brief moment before running the scheduler dispatch
    setTimeout(async () => {
      try {
        const { query: checkQuery } = require('../config/db');
        const due = await checkQuery('SELECT COUNT(*) AS count FROM event_reminders er JOIN events e ON e.id = er.event_id WHERE er.sent_at IS NULL AND e.date <= UTC_TIMESTAMP()');
        console.log('Number of due reminders waiting to be processed:', due[0].count);

        console.log('Running dispatch...');
        // We need to require and run
        const eventReminderScheduler = require('../utils/eventReminderScheduler');
        // Let's find the dispatch function. It's not exported directly, but startEventReminderScheduler is.
        // Wait, dispatchDueEventReminders is not exported, but startEventReminderScheduler(mockIo) will call it instantly!
        eventReminderScheduler.startEventReminderScheduler(mockIo);
        
        // Wait 3 seconds to check database notifications table
        setTimeout(async () => {
          const notifs = await checkQuery('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 2');
          console.log('--- LATEST NOTIFICATIONS IN DB AFTER DISPATCH ---');
          console.log(notifs);
          console.log('-------------------------------------------------');
          process.exit(0);
        }, 2000);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }, 1000);

  } catch (error) {
    console.error('Failed to run:', error.message);
    process.exit(1);
  }
}

run();
