const { createNotification } = require('../controllers/notificationController');
const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Creating a test notification directly...');
    const notification = await createNotification(
      1, // user_id
      1, // actor_id
      'EVENT_REMINDER',
      null,
      null,
      null,
      {
        allowSelf: true,
        content: 'Direct UTC Test'
      }
    );

    console.log('Resulting Notification Object:', JSON.stringify(notification, null, 2));

    // Verify raw database values
    if (notification && notification.id) {
      const rows = await query('SELECT id, type, created_at FROM notifications WHERE id = ?', [notification.id]);
      console.log('Raw DB Row:', rows[0]);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
