const { query } = require('../config/db');

async function ensureUserProfileSchema() {
  try {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS github TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio TEXT');
    // Supabase/Postgres migration safety: widen legacy MySQL-sized columns.
    await query('ALTER TABLE users ALTER COLUMN profile_picture TYPE TEXT');
    await query('ALTER TABLE users ALTER COLUMN cover_photo TYPE TEXT');
    await query('ALTER TABLE users ALTER COLUMN bio TYPE TEXT');
    console.log('User profile schema verified.');
  } catch (error) {
    console.error('Failed to verify user profile schema:', error);
  }
}

module.exports = ensureUserProfileSchema;