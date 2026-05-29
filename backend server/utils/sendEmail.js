const https = require('https');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyiTb_BTNQmrVlasoaelUjayrEpnDF6oOa4x1BhgMQ_X0p73tAjBdHoItES-UmzFs/exec';

// Simple HTTPS GET helper
const getRequest = (url) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GET timed out')); });
    req.end();
  });
};

// POST that follows Google's redirect pattern (POST → redirect → GET)
const postWithRedirect = (url, body) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      // Google Apps Script always redirects — follow it with GET
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        console.log(`[Google Apps Script] Following redirect to CDN...`);
        return getRequest(redirectUrl).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out after 15 seconds'));
    });
    req.write(body);
    req.end();
  });
};

const sendEmail = async (options) => {
  const payload = JSON.stringify({
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  });

  try {
    const response = await postWithRedirect(SCRIPT_URL, payload);

    if (response.status >= 400) {
      throw new Error(`Google Apps Script Error: HTTP ${response.status} - ${response.body}`);
    }

    let result = {};
    try { result = JSON.parse(response.body); } catch (_) {}

    if (result.error) {
      throw new Error(`Script returned error: ${result.error}`);
    }

    console.log(`[Google Apps Script] Email sent successfully to ${options.email}`);
  } catch (error) {
    console.error('[Google Apps Script] Failed to send email:', error.message);
    throw error;
  }
};

module.exports = sendEmail;
