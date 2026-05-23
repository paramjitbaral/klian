const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config({ path: '../.env' });

async function testUpload() {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 3 }, process.env.JWT_SECRET || 'secret');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('../package.json'));

  try {
    const res = await fetch('http://127.0.0.1:5000/api/messages/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch(e) {
    console.error(e);
  }
}
testUpload();
