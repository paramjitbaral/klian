const express = require('express');
const router = express.Router();
const { getNotifications, markAllAsRead, markByType, deleteNotificationById } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/read-type/:type', protect, markByType);
router.delete('/:id', protect, deleteNotificationById);

module.exports = router;
