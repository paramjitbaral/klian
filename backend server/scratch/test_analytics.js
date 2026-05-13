const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/analytics',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    try {
      console.log('Response Body:', JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log('Raw Body:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error);
});

req.end();
