const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Testing insert into event_reminders for event 1 and user 1...');
    await query('INSERT INTO event_reminders (event_id, user_id) VALUES (?, ?)', [1, 1]);
    console.log('Success inserting for user 1!');
    
    // Clean up
    await query('DELETE FROM event_reminders WHERE event_id = 1 AND user_id = 1');
    console.log('Cleaned up user 1!');
    
    console.log('Testing insert into event_reminders for event 1 and user 4...');
    await query('INSERT INTO event_reminders (event_id, user_id) VALUES (?, ?)', [1, 4]);
    console.log('Success inserting for user 4!');
    
    // Clean up
    await query('DELETE FROM event_reminders WHERE event_id = 1 AND user_id = 4');
    console.log('Cleaned up user 4!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Insert failed with error:');
    console.error('Error Code:', error.code);
    console.error('Error Msg:', error.message);
    process.exit(1);
  }
}

run();
