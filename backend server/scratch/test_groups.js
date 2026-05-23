require('dotenv').config({ path: '../.env' });
const { query } = require('../config/db');

async function test() {
  const q = await query('SELECT * FROM groups LIMIT 1');
  console.log('Groups count:', q.length);
  if (q.length > 0) {
    console.log('Group 0:', q[0]);
    const members = await query('SELECT * FROM group_members WHERE group_id = $1', [q[0].id]);
    console.log('Members:', members);
  }
}
test().then(() => process.exit(0));
