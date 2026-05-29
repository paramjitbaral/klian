const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase admin client for Auth
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
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

    // Auto-migrate legacy user to Supabase Auth if they don't exist yet
    await supabase.auth.admin.createUser({
      email: user.email,
      password: currentPassword,
      email_confirm: true
    }); // Silently fails if user already exists, which is fine

    // Ask Supabase to send the Reset Password OTP email
    const { error: supaError } = await supabase.auth.resetPasswordForEmail(user.email);
    if (supaError) {
      console.error('Supabase Reset Password Error:', supaError.message);
      return res.status(500).json({ message: 'Failed to send OTP via Supabase. ' + supaError.message });
    }

    res.json({ message: 'OTP sent to your email via Supabase' });
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

    // Verify the OTP via Supabase Auth
    const { data: supaData, error: supaError } = await supabase.auth.verifyOtp({
      email: user.email,
      token: otp,
      type: 'recovery'
    });

    if (supaError) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update password in Supabase Auth via Admin API
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const supaUser = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (supaUser) {
        await supabase.auth.admin.updateUserById(supaUser.id, { password: newPassword });
      }
    } catch (err) {
      console.error('Error updating Supabase password:', err.message);
      return res.status(500).json({ message: 'Failed to update password in Supabase' });
    }

    // Update password in custom database
    const salt = await require('bcryptjs').genSalt(10);
    const passwordHash = await require('bcryptjs').hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;