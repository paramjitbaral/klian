const { query } = require('./config/db');
require('dotenv').config();

async function setup() {
  try {
    console.log('Creating connected_emails table for Google OAuth...');
    await query(`
      CREATE TABLE IF NOT EXISTS connected_emails (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        email VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('connected_emails table created successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Setup failed:', e.message);
    process.exit(1);
  }
}

setup();
