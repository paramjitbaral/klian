const express = require('express');
const router = express.Router();
const { 
  createPost,
  updatePost,
  getPosts,
  getBroadcasts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  commentOnPost,
  deleteComment,
  updateComment,
  likeComment,
  unlikeComment,
  getTrendingHashtags,
  sharePost
} = require('../controllers/postController');
const { protect, facultyOnly } = require('../middleware/auth');

// All routes are protected
router.route('/')
  .post(protect, createPost)
  .get(protect, getPosts);

router.get('/broadcasts', protect, getBroadcasts);
router.get('/trending-hashtags', protect, getTrendingHashtags);

// Specific action routes MUST come before generic /:id route
router.put('/like/:id', protect, likePost);
router.put('/unlike/:id', protect, unlikePost);

router.post('/comment/:id', protect, commentOnPost);
router.delete('/comment/:id/:comment_id', protect, deleteComment);
router.put('/comment/:id/:comment_id', protect, updateComment);
router.put('/comment/like/:id/:comment_id', protect, likeComment);
router.put('/comment/unlike/:id/:comment_id', protect, unlikeComment);

// Generic /:id route comes last
router.route('/:id')
  .get(protect, getPostById)
  .put(protect, updatePost)
  .delete(protect, deletePost);

// Share post route
router.post('/share/:id', protect, sharePost);

module.exports = router;