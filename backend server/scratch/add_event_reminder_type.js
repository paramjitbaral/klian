const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Altering notifications table type ENUM to include EVENT_REMINDER...');
    await query("ALTER TABLE notifications MODIFY COLUMN type ENUM('LIKE', 'COMMENT', 'REPLY', 'SHARE', 'GROUP_ADDED', 'EVENT_REMINDER') NOT NULL");
    console.log('🎉 Successfully added EVENT_REMINDER to notifications type ENUM!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to alter notifications table:', error.message);
    process.exit(1);
  }
}

run();
