require('dotenv').config();
const { query } = require('../config/db');

async function run() {
    try {
        await query('ALTER TABLE `groups` ADD COLUMN only_admins_can_message TINYINT NOT NULL DEFAULT 0');
        console.log('Added only_admins_can_message column');
    } catch (e) {
        if (e.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column only_admins_can_message already exists');
        } else {
            console.error('Error adding column:', e);
        }
    }
    process.exit(0);
}

run();
