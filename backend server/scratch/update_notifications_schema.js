const { query } = require('../config/db');
require('dotenv').config();

async function updateSchema() {
  try {
    console.log('Updating notifications schema...');
    
    // 1. Add group_id column
    try {
      await query('ALTER TABLE notifications ADD COLUMN group_id INT UNSIGNED NULL');
      console.log('Added group_id column');
    } catch (e) {
      if (e.code !== 'ER_DUP_COLUMN_NAME') throw e;
      console.log('group_id column already exists');
    }
    
    // 2. Add content column
    try {
      await query('ALTER TABLE notifications ADD COLUMN content TEXT NULL');
      console.log('Added content column');
    } catch (e) {
      if (e.code !== 'ER_DUP_COLUMN_NAME') throw e;
      console.log('content column already exists');
    }
    
    // 3. Update type enum
    await query("ALTER TABLE notifications MODIFY COLUMN type ENUM('LIKE', 'COMMENT', 'REPLY', 'SHARE', 'GROUP_ADDED') NOT NULL");
    console.log('Updated type enum');

    // 4. Set actor_id to allow NULL (since GROUP_ADDED might not have an actor_id if it's system generated, or we can use the admin's ID)
    // Actually, actor_id is currently NOT NULL.
    // Let's check if we can make it NULL.
    await query("ALTER TABLE notifications MODIFY COLUMN actor_id INT UNSIGNED NULL");
    console.log('Modified actor_id to allow NULL');
    
    console.log('Schema updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update schema:', err);
    process.exit(1);
  }
}

updateSchema();
