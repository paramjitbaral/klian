require('dotenv').config({ path: '../.env' });
const { query } = require('../config/db');

async function main() {
  try {
    const res = await query(
      "DELETE FROM notifications WHERE type = 'EVENT_REMINDER' AND content = 'Event \"undefined\" is starting now.' RETURNING *"
    );
    console.log(`Deleted ${res.length} bad notifications.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
