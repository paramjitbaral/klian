// PostgreSQL connection pool using pg (for Supabase)
// Why: Supabase uses PostgreSQL; pool improves concurrency and reuse.
const dns = require('dns');
const { Pool } = require('pg');

let pool;

// Render/Supabase may resolve IPv6 first; force IPv4 to avoid ENETUNREACH on some hosts.
dns.setDefaultResultOrder('ipv4first');

async function initPool() {
  if (pool) return pool;
  try {
    const connectionString = process.env.DATABASE_URL;

    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        family: 4,
        max: Number(process.env.DATABASE_POOL_SIZE || 15),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      pool = new Pool({
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT || 5432),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: { rejectUnauthorized: false },
        family: 4,
        max: Number(process.env.DATABASE_POOL_SIZE || 15),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    // Simple test query to validate connection at boot
    await pool.query('SELECT 1');
    console.log('PostgreSQL pool initialized');
    return pool;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err.message);
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
  try {
    const result = await p.query(sql, params);
    return result.rows || [];
  } catch (err) {
    console.error('Query error:', err.message);
    throw err;
  }
}

module.exports = { initPool, query, getPool: () => pool };