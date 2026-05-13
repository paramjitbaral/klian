const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/inbox', emailController.getInbox);
router.get('/sent', emailController.getSent);
router.get('/trash', emailController.getTrash);
router.post('/', emailController.sendEmail);
router.put('/read/:emailId', emailController.markAsRead);
router.delete('/:emailId', emailController.moveToTrash);

module.exports = router;
