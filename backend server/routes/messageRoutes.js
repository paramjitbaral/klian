const express = require('express');
const router = express.Router();
const { 
  sendMessage,
  getMessagesWith,
  getConversations,
  sharePost
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

const upload = require('../middleware/uploadMiddleware');

// All routes are protected
router.route('/')
  .post(protect, sendMessage)
  .get(protect, getConversations);

router.post('/upload', protect, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ 
    url: fileUrl, 
    type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
    filename: req.file.originalname 
  });
});

router.get('/:userId', protect, getMessagesWith);

// Share post via message
router.post('/share', protect, sharePost);

module.exports = router;