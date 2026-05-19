const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

async function run() {
  try {
    // 1. Generate a JWT token for user ID 1 (DEAN)
    const token = jwt.sign(
      { id: 1, email: 'paramjitbaral@gmail.com' },
      process.env.JWT_SECRET || 'fallback_secret_for_dev',
      { expiresIn: '1h' }
    );
    console.log('Generated test token for DEAN:', token);

    // 2. Perform PUT request to toggle reminder on event 1
    const postData = JSON.stringify({ enabled: true });
    
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/events/reminder/1',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('Sending PUT /api/events/reminder/1...');
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        process.exit(0);
      });
    });

    req.on('error', (e) => {
      console.error('Request failed:', e.message);
      process.exit(1);
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('Test run failed:', error.message);
    process.exit(1);
  }
}

run();
