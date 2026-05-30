const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { sendBrevoEmail } = require('../utils/sendBrevoEmail');
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const { 
  registerUser, 
  loginUser, 
  verifyOTP,
  resendOTP,
  getUserProfile, 
  updateUserProfile,
  checkEmail
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const { generateCaptcha } = require('../utils/captcha');

// Public routes
router.get('/captcha', (req, res) => {
  const data = generateCaptcha();
  res.json(data);
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyOTP);
router.post('/resend-otp', resendOTP);
router.get('/check-email', checkEmail);

// Protected routes
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

router.put('/change-password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new passwords are required' });
  }

  try {
    const rows = await query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = rows[0];

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await require('bcryptjs').genSalt(10);
    const passwordHash = await require('bcryptjs').hash(newPassword, salt);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/request-password-otp', protect, async (req, res) => {
  const { currentPassword } = req.body;
  try {
    const rows = await query('SELECT password_hash, email FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = rows[0];

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query('UPDATE users SET verification_otp = $1, otp_expires = $2 WHERE id = $3', [otp, otpExpires, req.user.id]);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2c3e50; text-align: center;">Password Reset Request</h2>
        <p style="color: #34495e; font-size: 16px;">Hello,</p>
        <p style="color: #34495e; font-size: 16px;">We received a request to change your password. Please use the following 6-digit code to verify this change. This code will expire in 10 minutes.</p>
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="color: #dc2626; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
      </div>
    `;
    const emailSent = await sendBrevoEmail(user.email, 'User', 'Password Reset Verification Code', htmlContent);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send the OTP email.' });
    }

    res.json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/verify-password-change', protect, async (req, res) => {
  const { currentPassword, newPassword, otp } = req.body;
  try {
    const rows = await query('SELECT password_hash, email FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = rows[0];

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const otpRows = await query('SELECT verification_otp, otp_expires FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    if (!otpRows.length || otpRows[0].verification_otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    if (new Date() > new Date(otpRows[0].otp_expires)) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Update password in custom database
    const salt = await require('bcryptjs').genSalt(10);
    const passwordHash = await require('bcryptjs').hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, verification_otp = NULL, otp_expires = NULL WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;