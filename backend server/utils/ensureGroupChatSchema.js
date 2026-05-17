const { query } = require('../config/db');

async function ensureGroupChatSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        group_id INT UNSIGNED NOT NULL,
        sender_id INT UNSIGNED NOT NULL,
        content TEXT NOT NULL,
        type ENUM('text', 'image', 'file') NOT NULL DEFAULT 'text',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_group_messages_group (group_id, created_at, id),
        KEY idx_group_messages_sender (sender_id),
        CONSTRAINT fk_gm_group_message_group FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
        CONSTRAINT fk_gm_group_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await query("ALTER TABLE group_members ADD COLUMN notification_setting ENUM('all', 'mentions', 'off') NOT NULL DEFAULT 'all'");
    } catch (error) {
      if (error.code !== 'ER_DUP_COLUMN_NAME') throw error;
    }

    try {
      await query('ALTER TABLE group_members ADD COLUMN last_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0');
    } catch (error) {
      if (error.code !== 'ER_DUP_COLUMN_NAME') throw error;
    }

    try {
      await query('ALTER TABLE `groups` ADD COLUMN only_admins_can_message TINYINT NOT NULL DEFAULT 0');
    } catch (error) {
      if (error.code !== 'ER_DUP_COLUMN_NAME') throw error;
    }

    console.log('Group chat schema verified.');
  } catch (error) {
    console.error('Failed to verify group chat schema:', error);
  }
}

module.exports = ensureGroupChatSchema;
