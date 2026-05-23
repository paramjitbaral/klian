require('dotenv').config({path:'../.env'});
require('../config/db').query("SELECT * FROM notifications WHERE type = 'GROUP_ADDED' AND is_read = false")
  .then(res => console.log('Unread Group Add Notifs:', res.length))
  .catch(console.error);
