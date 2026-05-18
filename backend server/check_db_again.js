const { query } = require('./config/db');
require('dotenv').config();

async function run() {
  try {
    const rows = await query('SELECT * FROM connected_emails');
    console.log('Connected Emails:', JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Failed to query database:', error.message);
  }
  process.exit(0);
}

run();
