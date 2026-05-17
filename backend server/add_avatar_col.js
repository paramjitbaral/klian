require('dotenv').config();
const { query } = require('./config/db');
query('ALTER TABLE `groups` ADD COLUMN avatar VARCHAR(255) NULL')
    .then(() => {
        console.log('Added avatar column');
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
