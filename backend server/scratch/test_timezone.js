const path = require('path');
require('dotenv').config();
const { query } = require(path.join(__dirname, '..', 'config', 'db'));

async function run() {
  try {
    console.log('Connecting to PostgreSQL via shared DB config...');

    const rows = await query('SELECT date FROM events ORDER BY id DESC LIMIT 1');
    console.log('Query row output:', rows[0]);
    if (rows[0] && rows[0].date) {
      console.log('As date object:', rows[0].date);
      console.log('Serialized to JSON (ISO String):', JSON.stringify(rows[0].date));
    }

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

run();
