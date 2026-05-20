const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { 
  registerUser, 
  loginUser, 
  verifyOTP,
  resendOTP,
  getUserProfile, 
  updateUserProfile 
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
    const rows = await query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await require('bcryptjs').genSalt(10);
    const passwordHash = await require('bcryptjs').hash(newPassword, salt);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/request-password-otp', protect, async (req, res) => {
  const { currentPassword } = req.body;
  try {
    const rows = await query('SELECT password_hash, email FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      'UPDATE users SET verification_otp = ?, otp_expires = ? WHERE id = ?',
      [otp, otpExpires, req.user.id]
    );

    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: user.email,
      subject: 'Verification Code: Password Change',
      message: `Your verification code for password change is ${otp}.`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b;">
          <div style="background-color: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <span style="font-size: 24px;">🔒</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.025em;">Verify Identity</h1>
              <p style="font-size: 14px; color: #64748b; margin-top: 8px;">Enter the code below to finalize your password change.</p>
            </div>

            <div style="background-color: #f8fafc; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px;">Security Code</div>
              <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.2em; color: #ef4444; font-family: 'Courier New', Courier, monospace;">${otp}</div>
            </div>

            <div style="font-size: 12px; color: #94a3b8; line-height: 1.6; text-align: center;">
              <p>This code will expire in 10 minutes. If you didn't request this change, please ignore this email or contact support if you have concerns.</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
            <p>&copy; 2024 KLIAS Studio. All rights reserved.</p>
          </div>
        </div>
      `
    });

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/verify-password-change', protect, async (req, res) => {
  const { currentPassword, newPassword, otp } = req.body;
  try {
    const rows = await query('SELECT password_hash, verification_otp, otp_expires FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];

    if (user.verification_otp !== otp || new Date() > new Date(user.otp_expires)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const isMatch = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await require('bcryptjs').genSalt(10);
    const passwordHash = await require('bcryptjs').hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = ?, verification_otp = NULL, otp_expires = NULL WHERE id = ?',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;