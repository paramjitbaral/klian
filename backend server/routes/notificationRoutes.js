const express = require('express');
const router = express.Router();
const { getNotifications, markAllAsRead, deleteNotificationById } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllAsRead);
router.delete('/:id', protect, deleteNotificationById);

module.exports = router;
