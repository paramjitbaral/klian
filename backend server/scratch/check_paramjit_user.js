require('dotenv').config();
const { query } = require('../config/db');
(async () => {
  const rows = await query('SELECT id, email, role, is_verified, (password_hash IS NOT NULL) AS has_password_hash FROM users WHERE email = $1 LIMIT 1', ['paramjitbaral@gmail.com']);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
