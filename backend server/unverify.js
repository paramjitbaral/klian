require('dotenv').config();
const { initPool } = require('./config/db');

async function test() {
  const p = await initPool();
  await p.query("UPDATE users SET is_verified = false WHERE email='2300033156@kluniversity.in'");
  console.log('User un-verified successfully!');
  process.exit(0);
}
test();
