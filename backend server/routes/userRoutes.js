const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { searchUsers, getUsers, getUserById, getUserPosts, updateUser } = require('../controllers/userController');

// Routes
router.get('/search', searchUsers);
router.get('/', protect, getUsers);
router.get('/:id/posts', protect, getUserPosts);
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);

module.exports = router;