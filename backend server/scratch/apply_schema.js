require('dotenv').config({ path: '../.env' });
const ensureGroupChatSchema = require('../utils/ensureGroupChatSchema');
const { initPool } = require('../config/db');

async function main() {
  await initPool();
  await ensureGroupChatSchema();
  console.log('Done');
  process.exit(0);
}

main();
