const { query } = require('./config/db');
const axios = require('axios');
require('dotenv').config();

async function run() {
  try {
    const connections = await query('SELECT * FROM connected_emails WHERE provider = "microsoft" LIMIT 1');
    if (!connections.length) {
      console.log('No Microsoft connection found in database.');
      process.exit(0);
    }
    
    const conn = connections[0];
    console.log('Found connection for email:', conn.email);
    
    const emailId = 'AQMkADAwATMwMAItNWZkMi00OTc4LTAwAi0wMAoARgAAA_Y_XF8JWVRArgrYOkQMyLQHAM4XltiWP1VIiUCU9EAuPSMAAAIBDAAAAM4XltiWP1VIiUCU9EAuPSMAAtEQHzYAAAA=';
    console.log('Attempting to mark message as read ID:', emailId);
    
    const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(emailId)}`;
    console.log('Request URL:', url);
    
    const res = await axios.patch(
      url,
      { isRead: true },
      { headers: { Authorization: `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' } }
    ).catch(async (err) => {
      console.log('Error Status:', err.response?.status);
      console.log('Error Data:', JSON.stringify(err.response?.data, null, 2));
      throw err;
    });
    
    console.log('Success:', res.data);
  } catch (error) {
    console.error('Execution failed:', error.message);
  }
  process.exit(0);
}

run();
