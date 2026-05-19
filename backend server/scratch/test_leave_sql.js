const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const currentUserId = 1;
    const groupId = 2; // Test group ID from earlier
    
    console.log('Testing notification deletion SQL...');
    
    const sql = `
      DELETE FROM notifications 
      WHERE user_id = ? 
      AND type = "GROUP_ADDED" 
      AND (group_id = ? OR content LIKE (SELECT CONCAT('%', name, '%') FROM \`groups\` WHERE id = ? LIMIT 1))
    `;
    
    await query(sql, [currentUserId, groupId, groupId]);
    console.log('SQL Executed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('SQL Failed! Error Details:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    process.exit(1);
  }
}

run();
