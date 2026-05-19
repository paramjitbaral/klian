const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const notifications = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10');
    console.log('--- NOTIFICATIONS IN DB ---');
    console.log(notifications);
    console.log('---------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Failed to query:', error.message);
    process.exit(1);
  }
}

run();
