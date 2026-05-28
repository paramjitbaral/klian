const sendEmail = async (options) => {
  const apiKey = process.env.EMAIL_PASS;
  
  if (!apiKey || apiKey === 're_your_api_key_here') {
    console.error('Email sending failed: Resend API key is missing.');
    return;
  }

  // Use the verified domain if configured, otherwise use Resend's default testing domain
  const fromAddress = process.env.EMAIL_USER === 'resend' 
    ? 'KLIAS Support <onboarding@resend.dev>' 
    : `KLIAS Support <${process.env.EMAIL_USER}>`;

  const payload = {
    from: fromAddress,
    to: [options.email],
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Resend API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }
};

module.exports = sendEmail;
