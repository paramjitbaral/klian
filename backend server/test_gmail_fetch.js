const { query } = require('./config/db');
const { google } = require('googleapis');
require('dotenv').config();

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:5000/api/emails/google/callback'
  );
};

async function test() {
  try {
    console.log('Fetching connected emails...');
    const connections = await query('SELECT * FROM connected_emails');
    console.log('Connected accounts count:', connections.length);
    if (!connections.length) {
      console.log('No connected emails found in database.');
      process.exit(0);
    }
    
    for (const conn of connections) {
      console.log(`\nTesting for user_id: ${conn.user_id}, email: ${conn.email}`);
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({
        access_token: conn.access_token,
        refresh_token: conn.refresh_token
      });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      console.log('Listing messages...');
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5
      });
      
      console.log('Response messages count:', response.data.messages ? response.data.messages.length : 0);
      const messages = response.data.messages || [];
      for (const msg of messages) {
        try {
          console.log(`Fetching message detail for: ${msg.id}`);
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id
          });
          console.log(`Success! Subject:`, detail.data.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value);
        } catch (detailErr) {
          console.error(`Error fetching detail for ${msg.id}:`, detailErr.message);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Test script failed with error:', err);
    process.exit(1);
  }
}

test();
