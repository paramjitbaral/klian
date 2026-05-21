const { query } = require('../config/db');

async function ensureUserProfileSchema() {
  try {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS github TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio TEXT');
    console.log('User profile schema verified.');
  } catch (error) {
    console.error('Failed to verify user profile schema:', error);
  }
}

module.exports = ensureUserProfileSchema;