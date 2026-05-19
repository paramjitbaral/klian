const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const reminders = await query('SELECT * FROM event_reminders');
    console.log('--- EVENT REMINDERS STATUS ---');
    console.log(reminders);
    console.log('------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Failed to query:', error.message);
    process.exit(1);
  }
}

run();
