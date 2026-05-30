const axios = require('axios');

const sendBrevoEmail = async (toEmail, toName, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('BREVO_API_KEY is not defined in .env');
    return false;
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'Klians App', email: 'paramjitbaral44@gmail.com' },
        to: [{ email: toEmail, name: toName || 'User' }],
        subject: subject,
        htmlContent: htmlContent,
      },
      {
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending Brevo email:', error.response?.data || error.message);
    return false;
  }
};

module.exports = { sendBrevoEmail };
