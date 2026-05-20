const path = require('path');
// Ensure __dirname resolves from repo root when invoked from project root
const db = require(path.join(__dirname, '..', 'config', 'db'));

(async () => {
  try {
    await db.initPool();
    console.log('DB pool initialized. Running quick checks...');

    // Current timestamp and example counts
    const now = await db.query('SELECT NOW() as now');
    console.log('Server time:', now[0]?.now);

    // List public tables
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Public tables:', tables.map(r => r.table_name));

    // Count users (if exists)
    try {
      const users = await db.query('SELECT count(*)::int as cnt FROM users');
      console.log('Users count:', users[0]?.cnt);
    } catch (e) {
      console.warn('Could not query users table (may not exist):', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error('DB connection test failed:', err.message || err);
    process.exit(1);
  }
})();
