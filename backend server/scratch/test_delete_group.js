const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Testing deletion of a dummy group...');
    // Create a dummy group
    const groupResult = await query('INSERT INTO `groups` (name, description, created_by) VALUES (?, ?, ?)', ['Delete Test Group', 'test', 1]);
    const gid = groupResult.insertId;
    console.log('Created test group with ID:', gid);

    // Add a member
    await query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [gid, 1, 'admin']);
    console.log('Added admin member to test group');

    // Add a message
    await query('INSERT INTO group_messages (group_id, sender_id, content, type) VALUES (?, ?, ?, ?)', [gid, 1, 'Test message', 'text']);
    console.log('Added message to test group');

    // Add a notification
    await query('INSERT INTO notifications (user_id, type, content, group_id) VALUES (?, ?, ?, ?)', [1, 'GROUP_ADDED', 'Added to group', gid]);
    console.log('Added notification pointing to test group');

    // Now try to delete the group
    console.log('Attempting to delete the group...');
    await query('DELETE FROM `groups` WHERE id = ?', [gid]);
    console.log('SUCCESS! Group deleted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('FAILED TO DELETE GROUP! Error code:', error.code);
    console.error('Error Message:', error.message);
    process.exit(1);
  }
}

run();
