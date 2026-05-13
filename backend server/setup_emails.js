const { query } = require('./config/db');
require('dotenv').config();

async function setup() {
  try {
    console.log('Creating emails table...');
    await query(`
      CREATE TABLE IF NOT EXISTS emails (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sender_id INT UNSIGNED NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sender_deleted TINYINT(1) DEFAULT 0,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Creating email_recipients table...');
    await query(`
      CREATE TABLE IF NOT EXISTS email_recipients (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email_id INT UNSIGNED NOT NULL,
        recipient_id INT UNSIGNED NOT NULL,
        type ENUM('to', 'cc', 'bcc') DEFAULT 'to',
        is_read TINYINT(1) DEFAULT 0,
        is_deleted TINYINT(1) DEFAULT 0,
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Email tables created successfully');
    process.exit(0);
  } catch (e) {
    console.error('Setup failed:', e.message);
    process.exit(1);
  }
}

setup();
