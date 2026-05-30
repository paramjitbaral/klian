require('dotenv').config();
const { sendBrevoEmail } = require('./utils/sendBrevoEmail');

async function test() {
  console.log('Testing Brevo API Connection...');
  const result = await sendBrevoEmail(
    'test@example.com', // Replace with a valid email if needed, but Brevo should accept test emails
    'Test User',
    'Brevo API Test',
    '<h1>Success!</h1><p>The Brevo API is working correctly.</p>'
  );
  if (result) {
    console.log('Email sent successfully!', result);
  } else {
    console.error('Failed to send email.');
  }
}

test();
