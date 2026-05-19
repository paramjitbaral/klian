const { query } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Fetching active events...');
    const events = await query('SELECT title FROM events');
    const activeTitles = events.map(e => e.title);
    console.log('Active Event Titles:', activeTitles);

    // Fetch all current EVENT_REMINDER notifications
    const notifications = await query("SELECT id, content FROM notifications WHERE type = 'EVENT_REMINDER'");
    console.log('Current Event Notifications in DB:', notifications);

    let deletedCount = 0;
    for (const notif of notifications) {
      // If it's a test notification or doesn't match any active event, delete it!
      let matchesActive = false;
      for (const title of activeTitles) {
        if (notif.content === `Event "${title}" is starting now.`) {
          matchesActive = true;
          break;
        }
      }

      if (!matchesActive) {
        console.log(`Wiping orphan/test notification: "${notif.content}" (ID: ${notif.id})`);
        await query('DELETE FROM notifications WHERE id = ?', [notif.id]);
        deletedCount++;
      }
    }

    console.log(`🎉 Cleanup complete! Wiped ${deletedCount} orphan/test notifications from the database.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to cleanup:', error.message);
    process.exit(1);
  }
}

run();
