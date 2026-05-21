require('dotenv').config();
const axios = require('axios');
(async () => {
  try {
    await axios.post('http://localhost:5000/api/auth/login', {
      email: 'paramjitbaral@gmail.com',
      password: 'wrong-password'
    });
    console.log('Unexpected success');
  } catch (e) {
    const status = e.response?.status;
    const body = e.response?.data;
    console.log(JSON.stringify({ status, body }, null, 2));
  }
})();
