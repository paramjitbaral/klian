const dns = require('dns');
const pg = require('pg');
const { Pool } = pg;

// Override the default parser for TIMESTAMP (without timezone) to parse as UTC
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (stringValue) => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

let pool;

// Render/Supabase may resolve IPv6 first; force IPv4 to avoid ENETUNREACH on some hosts.
dns.setDefaultResultOrder('ipv4first');

async function initPool() {
  if (pool) return pool;
  try {
    const connectionString = process.env.DATABASE_URL;
    const sslEnv = String(process.env.DATABASE_SSL || '').trim().toLowerCase();

    const resolveSsl = (host) => {
      if (['false', '0', 'off', 'no'].includes(sslEnv)) return false;
      if (['true', '1', 'on', 'yes'].includes(sslEnv)) return { rejectUnauthorized: false };

      // Auto mode: local DB usually has no SSL; hosted DB should use SSL.
      const normalizedHost = String(host || '').toLowerCase();
      const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1';
      return isLocal ? false : { rejectUnauthorized: false };
    };

    if (connectionString) {
      let parsedHost = '';
      try {
        parsedHost = new URL(connectionString).hostname;
      } catch {
        parsedHost = '';
      }

      pool = new Pool({
        connectionString,
        ssl: resolveSsl(parsedHost),
        max: Number(process.env.DATABASE_POOL_SIZE || 15),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      const host = process.env.DATABASE_HOST;
      pool = new Pool({
        host,
        port: Number(process.env.DATABASE_PORT || 5432),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: resolveSsl(host),
        max: Number(process.env.DATABASE_POOL_SIZE || 15),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    // Simple test query to validate connection at boot
    await pool.query('SELECT 1');
    console.log('PostgreSQL pool initialized');
    return pool;
  } catch (err) {
    pool = undefined;
    console.error('Failed to initialize PostgreSQL pool:', err.message);
    throw err;
  }
}

// Helper for safe queries with automatic pool init
async function query(sql, params) {
  const p = await initPool();
  if (!p) {
    throw new Error('DB pool not initialized');
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