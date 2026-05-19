const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const users = await query('SELECT id, name, email, role FROM users');
    console.log('--- USERS IN DB ---');
    console.log(users);
    console.log('-------------------');
    process.exit(0);
  } catch (error) {
    console.error('Failed to query:', error.message);
    process.exit(1);
  }
}

run();
