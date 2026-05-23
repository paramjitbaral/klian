const { query } = require('../config/db');

async function ensureGroupChatSchema() {
  try {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS group_messages (
          id BIGSERIAL PRIMARY KEY,
          group_id INT NOT NULL,
          sender_id INT NOT NULL,
          content TEXT NOT NULL,
          type message_type NOT NULL DEFAULT 'text',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_gm_group_message_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          CONSTRAINT fk_gm_group_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await query(`CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at, id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id)`);

      // Add post_id column if it doesn't exist (for sharing posts to group chat)
      await query('ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS post_id INT');
      await query('ALTER TABLE group_messages DROP CONSTRAINT IF EXISTS fk_gm_post_id');
      await query('ALTER TABLE group_messages ADD CONSTRAINT fk_gm_post_id FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL');

      await query("ALTER TABLE group_members ADD COLUMN IF NOT EXISTS notification_setting notification_setting NOT NULL DEFAULT 'all'");
    } catch (error) {
      throw error;
    }

    try {
      await query('ALTER TABLE group_members ADD COLUMN IF NOT EXISTS last_read_id BIGINT NOT NULL DEFAULT 0');
    } catch (error) {
      throw error;
    }

    try {
      await query('ALTER TABLE groups ADD COLUMN IF NOT EXISTS only_admins_can_message BOOLEAN NOT NULL DEFAULT false');
      await query('ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar VARCHAR(255)');
    } catch (error) {
      throw error;
    }

    console.log('Group chat schema verified.');
  } catch (error) {
    console.error('Failed to verify group chat schema:', error);
  }
}

module.exports = ensureGroupChatSchema;
