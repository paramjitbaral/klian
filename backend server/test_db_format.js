require('dotenv').config();
const { query, initPool } = require('./config/db');

async function test() {
  await initPool();
  const rows = await query(`
    SELECT id, created_at, 
           DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS formatted_z,
           DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS formatted_z_ms
    FROM posts 
    ORDER BY id DESC LIMIT 5
  `);
  console.log(rows);
  process.exit(0);
}

test();
