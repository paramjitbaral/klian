const { query } = require('../config/db');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function updateSchema() {
  try {
    console.log('Updating schema...');

    // 1. Create group_messages table
    await query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        group_id INT UNSIGNED NOT NULL,
        sender_id INT UNSIGNED NOT NULL,
        content VARCHAR(2000) NULL,
        type ENUM('text', 'image', 'file') NOT NULL DEFAULT 'text',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_gm_group (group_id, created_at),
        CONSTRAINT fk_gm_group_id FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
        CONSTRAINT fk_gm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Table group_messages checked/created.');

    // 2. Add notification_setting to group_members
    try {
      await query("ALTER TABLE group_members ADD COLUMN notification_setting ENUM('all', 'mentions', 'off') DEFAULT 'all'");
      console.log('Added notification_setting to group_members.');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('notification_setting already exists.');
      } else {
        throw e;
      }
    }

    // 3. Add last_read_id to group_members
    try {
      await query("ALTER TABLE group_members ADD COLUMN last_read_id BIGINT UNSIGNED DEFAULT 0");
      console.log('Added last_read_id to group_members.');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('last_read_id already exists.');
      } else {
        throw e;
      }
    }

    console.log('Schema update complete.');
    process.exit(0);
  } catch (err) {
    console.error('Schema update failed:', err);
    process.exit(1);
  }
}

updateSchema();
