const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token (MySQL)
      const rows = await query('SELECT id, name, email, role, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, cabin_number AS cabinNumber FROM users WHERE id = $1 LIMIT 1', [decoded.id]);
      if (!rows.length) return res.status(401).json({ message: 'Not authorized, user not found' });
      req.user = rows[0];

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to check if user is faculty (teachers/admins)
const facultyOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'Teacher' || req.user.role === 'Admin' || req.user.role === 'Dean')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Faculty only.' });
  }
};

module.exports = { protect, facultyOnly };