const { query } = require('../config/db');

async function ensurePostCommentsSchema() {
  try {
    await query('ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL');
    console.log('Post comments schema verified.');
  } catch (error) {
    console.error('Failed to verify post comments schema:', error);
  }
}

module.exports = ensurePostCommentsSchema;