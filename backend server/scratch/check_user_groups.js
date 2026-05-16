const { query } = require('../config/db');
require('dotenv').config();

async function checkGroups(userId) {
  try {
    const groupsRows = await query(
      `SELECT g.id, g.name FROM \`groups\` g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?`,
      [userId]
    );

    const results = [];
    for (const group of groupsRows) {
      const gmRow = await query('SELECT last_read_id FROM group_members WHERE group_id = ? AND user_id = ?', [group.id, userId]);
      const lastReadId = gmRow[0]?.last_read_id || 0;
      const unreadRow = await query('SELECT COUNT(*) AS cnt FROM group_messages WHERE group_id = ? AND id > ?', [group.id, lastReadId]);
      results.push({ name: group.name, unreadCount: unreadRow[0].cnt, lastReadId });
    }
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Assuming the user in the screenshot is the one with id 1 or similar
// I'll try to find the user id from the sessions or just use the one we were using
checkGroups(1); 
