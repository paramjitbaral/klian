const { query } = require('../config/db');

async function ensureNotificationsSchema() {
  try {
    await query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id INT NULL');
    await query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id BIGINT NULL');
    await query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id BIGINT NULL');
    console.log('Notifications schema verified.');
  } catch (error) {
    console.error('Failed to verify notifications schema:', error);
  }
}

module.exports = ensureNotificationsSchema;
