const express = require('express');
const router = express.Router();
const { 
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  addMembers,
  removeMember,
  updateMemberRole,
  updateNotificationSetting,
  markAsRead,
  deleteMessage
} = require('../controllers/groupController');
const { protect, facultyOnly } = require('../middleware/auth');

// All routes are protected
router.route('/')
  .post(protect, facultyOnly, createGroup)
  .get(protect, getGroups);

router.route('/:id')
  .get(protect, getGroupById)
  .put(protect, updateGroup)
  .delete(protect, deleteGroup);

router.put('/join/:id', protect, joinGroup);
router.put('/leave/:id', protect, leaveGroup);
router.post('/:id/members', protect, addMembers);
router.delete('/:id/members/:userId', protect, removeMember);
router.put('/:id/members/role', protect, updateMemberRole);
router.put('/:id/notification-setting', protect, updateNotificationSetting);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id/messages/:msgId', protect, deleteMessage);

module.exports = router;

module.exports = router;