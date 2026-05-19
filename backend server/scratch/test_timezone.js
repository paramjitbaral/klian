const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    console.log('Connecting to MySQL WITH timezone Z...');
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'Swaraj@0405',
      database: process.env.MYSQL_DATABASE || 'klians_db',
      timezone: 'Z'
    });

    const [rows] = await pool.query('SELECT date FROM events LIMIT 1');
    console.log('Query row output:', rows[0]);
    if (rows[0] && rows[0].date) {
      console.log('As date object:', rows[0].date);
      console.log('Serialized to JSON (ISO String):', JSON.stringify(rows[0].date));
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

run();
