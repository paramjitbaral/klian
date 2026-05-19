const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const reminders = await query('SELECT * FROM event_reminders');
    console.log('--- EVENT REMINDERS IN DB ---');
    console.log(reminders);
    console.log('-----------------------------');
    
    const events = await query('SELECT id, title FROM events');
    console.log('--- EVENTS IN DB ---');
    console.log(events);
    console.log('--------------------');
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to query:', error.message);
    process.exit(1);
  }
}

run();
