const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const getExternalAdminEmailAllowlist = () => {
  const fromEnv = String(process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  // Keep the existing admin exception as a fallback if env is not set yet.
  return fromEnv.length ? fromEnv : ['paramjitbaral@gmail.com'];
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.length) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate email format based on role (allowing @gmail.com for testing)
    if (role === 'student' && !/^\d{10}@kluniversity\.in$/.test(email) && !email.endsWith('@gmail.com')) {
      return res.status(400).json({ 
        message: 'Student email must be in format: 10digitnumber@kluniversity.in or end with @gmail.com for testing' 
      });
    }

    if (role === 'faculty' && !/^[a-zA-Z]+@kluniversity\.in$/.test(email) && !email.endsWith('@gmail.com')) {
      return res.status(400).json({ 
        message: 'Faculty email must be in format: name@kluniversity.in or end with @gmail.com for testing' 
      });
    }

    // Standardize role for frontend compatibility
    const standardizedRole = role === 'admin' ? 'Admin' : (role === 'faculty' ? 'Teacher' : 'Student');
    
    // Admin accounts are auto-verified
    const isVerified = standardizedRole === 'Admin' ? true : false;

    // Generate 6-digit OTP (only if not admin)
    const otp = isVerified ? null : Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = isVerified ? null : new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash password and insert
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role, is_verified, verification_otp, otp_expires) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, email, passwordHash, standardizedRole, isVerified, otp, otpExpires]
    );
    const userId = result[0]?.id;

    if (!isVerified && process.env.NODE_ENV !== 'production') {
      console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
    }

    // Send Email asynchronously (only if not admin)
    if (!isVerified) {
      const sendEmail = require('../utils/sendEmail');
      try {
        await sendEmail({
          email: email,
          subject: 'KLIAS Verification Code',
          message: `Your verification code is ${otp}. It will expire in 10 minutes.`,
          html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                  <h2>KLIAS Verification</h2>
                  <p>Use the following code to verify your account:</p>
                  <h1 style="color: #ef4444; font-size: 40px; letter-spacing: 5px;">${otp}</h1>
                  <p>This code will expire in 10 minutes.</p>
                </div>`
        });
      } catch (emailError) {
        console.error('Registration OTP Email could not be sent:', emailError.message);
        // We still want to let the user know, but let's fail the registration if email fails
        return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' });
      }
    }

    res.status(201).json({
      message: isVerified ? 'Registration successful.' : 'Registration successful. Please check your email for the verification code.',
      email: email,
      requiresVerification: !isVerified,
      token: isVerified ? generateToken(userId) : null
    });
    
    // Emit event if verified user created
    if (isVerified) {
      const io = req.app.get('io');
      if (io) io.emit('user-registered', { id: userId, name, email, role: standardizedRole });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const rows = await query('SELECT id, is_verified FROM users WHERE email = $1 LIMIT 1', [email]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    
    if (rows[0].is_verified) {
      return res.status(400).json({ message: 'Account is already verified' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      'UPDATE users SET verification_otp = $1, otp_expires = $2 WHERE email = $3',
      [otp, otpExpires, email]
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV MODE] Resend OTP for ${email}: ${otp}`);
    }

    // Send Email asynchronously
    const sendEmail = require('../utils/sendEmail');
    try {
      await sendEmail({
        email: email,
        subject: 'KLIAS New Verification Code',
        message: `Your new verification code is ${otp}. It will expire in 10 minutes.`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2>KLIAS Verification</h2>
                <p>Use the following new code to verify your account:</p>
                <h1 style="color: #ef4444; font-size: 40px; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes.</p>
              </div>`
      });
    } catch (emailError) {
      console.error('Resend OTP Email could not be sent. Please check SMTP configuration:', emailError.message);
      return res.status(500).json({ message: 'Failed to resend verification email. Please try again later.' });
    }

    res.json({ message: 'New verification code sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const rows = await query(
      'SELECT id, verification_otp, otp_expires FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    if (user.verification_otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (new Date() > new Date(user.otp_expires)) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Mark as verified
    await query(
      'UPDATE users SET is_verified = true, verification_otp = NULL, otp_expires = NULL WHERE id = $1',
      [user.id]
    );

    res.json({
      message: 'Account verified successfully. You can now login.',
      token: generateToken(user.id)
    });
    
    // Emit user-registered event
    const io = req.app.get('io');
    if (io) io.emit('user-registered', { id: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password, captchaAnswer, captchaToken } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const isAllowlistedExternalAdmin = getExternalAdminEmailAllowlist().includes(normalizedEmail);

    // Demo account for testing bypasses CAPTCHA to ensure smooth local testing environment
    if (normalizedEmail === '2300032645@kluniversity.in' && password === 'password123') {
      return res.json({
        _id: 1,
        id: 1,
        name: 'Demo Student',
        email: '2300032645@kluniversity.in',
        role: 'Student',
        profilePicture: '',
        coverPhoto: '',
        bio: '',
        linkedin: '',
        github: '',
        portfolio: '',
        cabinNumber: '',
        token: generateToken(1),
      });
    }

    // Verify stateless math CAPTCHA
    if (!isAllowlistedExternalAdmin) {
      const { verifyCaptcha } = require('../utils/captcha');
      if (!verifyCaptcha(captchaAnswer, captchaToken)) {
        return res.status(400).json({ message: 'Incorrect or expired CAPTCHA verification code' });
      }
    }

    const rows = await query('SELECT id, name, email, role, password_hash, is_verified, profile_picture AS "profilePicture", cover_photo AS "coverPhoto", bio, cabin_number AS "cabinNumber", linkedin, github, portfolio FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalizedEmail]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid email or password' });
    const user = rows[0];

    // Check if user is verified
    if (!user.is_verified) {
      return res.status(401).json({ 
        message: 'Account not verified. Please check your email for the verification code.',
        requiresVerification: true,
        email: user.email
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    delete user.password_hash;
    res.json({
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      coverPhoto: user.coverPhoto,
      bio: user.bio,
      linkedin: user.linkedin,
      github: user.github,
      portfolio: user.portfolio,
      cabinNumber: user.cabinNumber,
      token: generateToken(user.id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const rows = await query('SELECT id, name, email, role, profile_picture AS "profilePicture", cover_photo AS "coverPhoto", bio, cabin_number AS "cabinNumber", linkedin, github, portfolio FROM users WHERE id = $1 LIMIT 1', [req.user.id || req.user._id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];
    res.json({
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      coverPhoto: user.coverPhoto,
      bio: user.bio,
      linkedin: user.linkedin,
      github: user.github,
      portfolio: user.portfolio,
      cabinNumber: user.cabinNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rows = await query('SELECT id, role FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const role = rows[0].role;

    const fields = [];
    const params = [];
    if (req.body.name !== undefined) { fields.push('name = $' + (params.length + 1)); params.push(req.body.name); }
    if (req.body.profilePicture !== undefined) { fields.push('profile_picture = $' + (params.length + 1)); params.push(req.body.profilePicture); }
    if (req.body.coverPhoto !== undefined) { fields.push('cover_photo = $' + (params.length + 1)); params.push(req.body.coverPhoto); }
    if (req.body.bio !== undefined) { fields.push('bio = $' + (params.length + 1)); params.push(req.body.bio); }
    if (req.body.linkedin !== undefined) { fields.push('linkedin = $' + (params.length + 1)); params.push(req.body.linkedin); }
    if (req.body.github !== undefined) { fields.push('github = $' + (params.length + 1)); params.push(req.body.github); }
    if (req.body.portfolio !== undefined) { fields.push('portfolio = $' + (params.length + 1)); params.push(req.body.portfolio); }
    if (role === 'faculty' && req.body.cabinNumber) {
      if (/^[a-zA-Z]\d{3}$/.test(req.body.cabinNumber)) {
        fields.push('cabin_number = $' + (params.length + 1)); params.push(req.body.cabinNumber);
      } else {
        return res.status(400).json({ message: 'Cabin number must be in format: letter followed by 3 digits (e.g., C001)' });
      }
    }

    if (req.body.password !== undefined) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(req.body.password, salt);
      fields.push('password_hash = $' + (params.length + 1)); params.push(passwordHash);
    }

    if (!fields.length) return res.json({ message: 'No changes' });
    params.push(userId);
    const paramIndex = params.length;
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, params);

    const updated = await query('SELECT id, name, email, role, profile_picture AS "profilePicture", cover_photo AS "coverPhoto", bio, linkedin, github, portfolio, cabin_number AS "cabinNumber" FROM users WHERE id = $1 LIMIT 1', [userId]);
    const u = updated[0];
    res.json({
      _id: u.id,
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profilePicture: u.profilePicture,
      coverPhoto: u.coverPhoto,
      bio: u.bio,
      linkedin: u.linkedin,
      github: u.github,
      portfolio: u.portfolio,
      cabinNumber: u.cabinNumber,
      token: generateToken(u.id),
    });
  } catch (error) {
    console.error(error);
    if (error && error.code === '22001') {
      return res.status(400).json({ message: 'One or more profile fields are too long. Please shorten text or image data.' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const rows = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    res.json({ exists: rows.length > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  checkEmail,
  registerUser,
  loginUser,
  verifyOTP,
  resendOTP,
  getUserProfile,
  updateUserProfile
};