require('dotenv').config();
const { query } = require('../config/db');

async function checkSchema() {
  try {
    const columns = await query('SHOW COLUMNS FROM notifications');
    console.log(JSON.stringify(columns, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
