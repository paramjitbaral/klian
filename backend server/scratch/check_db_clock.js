const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const time = await query('SELECT NOW(), UTC_TIMESTAMP()');
    console.log('--- MYSQL SERVER CLOCK ---');
    console.log(time[0]);
    console.log('--------------------------');
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

run();
