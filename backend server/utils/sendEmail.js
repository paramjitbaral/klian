const sendEmail = async (options) => {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyiTb_BTNQmrVlasoaelUjayrEpnDF6oOa4x1BhgMQ_X0p73tAjBdHoItES-UmzFs/exec';

  const payload = {
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json().catch(() => ({}));
    if (result.error) {
      throw new Error(`Script Execution Error: ${result.error}`);
    }
    
    console.log(`[Google Apps Script] Email sent successfully to ${options.email}`);
  } catch (error) {
    console.error('[Google Apps Script] Failed to send email:', error.message);
    throw error;
  }
};

module.exports = sendEmail;
