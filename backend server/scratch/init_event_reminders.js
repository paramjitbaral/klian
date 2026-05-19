const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Ensuring event_reminders table exists...');
    
    // First, let's check if the event_reminders table exists by running a simple query on it
    await query(`
      CREATE TABLE IF NOT EXISTS event_reminders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_event_reminder (event_id, user_id),
        KEY idx_event_reminders_user (user_id, sent_at),
        CONSTRAINT fk_er_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        CONSTRAINT fk_er_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('🎉 event_reminders table is successfully verified and created in the database!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to ensure event_reminders table:', error.message);
    process.exit(1);
  }
}

run();
