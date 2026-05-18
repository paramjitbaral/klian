const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { protect } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Custom middleware for initiating Google/Microsoft OAuth (to support JWT in query params)
const protectOAuthInit = async (req, res, next) => {
  let token = req.query.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev');
    const rows = await query('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [decoded.id]);
    if (!rows.length) return res.status(401).json({ message: 'Not authorized, user not found' });
    req.user = rows[0];
    next();
  } catch (error) {
    console.error('protectOAuthInit error:', error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Public Google & Microsoft callbacks (handles their own state verification)
router.get('/google/callback', emailController.googleCallback);
router.get('/outlook/callback', emailController.outlookCallback);

// Google & Microsoft Auth initiators
router.get('/google', protectOAuthInit, emailController.googleAuth);
router.get('/outlook', protectOAuthInit, emailController.outlookAuth);

// All other routes require standard Bearer token verification
router.use(protect);

router.get('/status', emailController.getStatus);
router.post('/disconnect', emailController.disconnect);
router.get('/inbox', emailController.getInbox);
router.get('/sent', emailController.getSent);
router.get('/trash', emailController.getTrash);
router.post('/send', emailController.sendEmail);
router.post('/', emailController.sendEmail);
router.put('/read/:emailId', emailController.markAsRead);
router.post('/restore/:emailId', emailController.restoreFromTrash);
router.delete('/permanent/:emailId', emailController.deletePermanently);
router.post('/empty-trash', emailController.emptyTrash);
router.delete('/:emailId', emailController.moveToTrash);

module.exports = router;
