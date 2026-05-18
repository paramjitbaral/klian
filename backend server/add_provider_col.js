const { query } = require('./config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Adding provider column to connected_emails...');
    await query(`
      ALTER TABLE connected_emails 
      ADD COLUMN provider VARCHAR(50) NOT NULL DEFAULT 'google' AFTER user_id
    `);
    console.log('Column added successfully!');
    process.exit(0);
  } catch (e) {
    console.log('Column may already exist or error:', e.message);
    process.exit(0);
  }
}
run();
