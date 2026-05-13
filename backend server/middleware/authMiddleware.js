const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Middleware to protect routes
exports.protect = async (req, res, next) => {
  let token;
  
  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev');
      
      // Get user from token (MySQL)
      const rows = await query('SELECT id, name, email, role, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, cabin_number AS cabinNumber FROM users WHERE id = ? LIMIT 1', [decoded.id]);
      if (!rows.length) return res.status(401).json({ message: 'Not authorized, user not found' });
      req.user = rows[0];
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to check if user is admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};

// Middleware to check if user is faculty
exports.faculty = (req, res, next) => {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as faculty' });
  }
};