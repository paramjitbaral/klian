require('dotenv').config();
const { initPool } = require('./config/db');

async function test() {
  const p = await initPool();
  const res = await p.query("SELECT * FROM users WHERE email='2300033156@kluniversity.in'");
  console.log(res.rows[0]);
  process.exit(0);
}
test();
