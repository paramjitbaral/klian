// MySQL connection pool using mysql2/promise
// Why: Replace MongoDB with MySQL for Free Tier Ubuntu VM; pool improves concurrency and reuse.
const mysql = require('mysql2/promise');

let pool;

async function initPool() {
  if (pool) return pool;
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'appuser',
      password: process.env.MYSQL_PASSWORD || 'app_password',
      database: process.env.MYSQL_DATABASE || 'klians',
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 15),
      queueLimit: 0
    });
    // Simple test query to validate connection at boot
    await pool.query('SELECT 1');
    console.log('MySQL pool initialized (Native Timezone)');
    return pool;
  } catch (err) {
    console.error('Failed to initialize MySQL pool:', err.message);
    // Don't exit, allow app to run in mock mode
  }
}

// Helper for safe queries with automatic pool init
async function query(sql, params) {
  const p = await initPool();
  if (!p) {
    console.warn('DB Query attempted but pool not initialized. Returning empty result.');
    return [];
  }
  const [rows] = await p.query(sql, params);
  return rows;
}

module.exports = { initPool, query, getPool: () => pool };