const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAnnouncements,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteAnnouncement,
  updateAnnouncement
} = require('../controllers/announcementController');
const { protect, facultyOnly } = require('../middleware/auth');

// All routes are protected
router.get('/', protect, getAnnouncements);
router.get('/unread-count', protect, getUnreadCount);

// Create announcement (teachers and admins only)
router.post('/', protect, facultyOnly, createAnnouncement);

// Mark all as read
router.put('/read-all', protect, markAllAsRead);

// Mark as read
router.put('/read/:announcementId', protect, markAsRead);

// Update announcement (author or admin only)
router.put('/:announcementId', protect, updateAnnouncement);

// Delete announcement (author or admin only)
router.delete('/:announcementId', protect, deleteAnnouncement);

module.exports = router;
