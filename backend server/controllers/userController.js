const { query } = require('../config/db');

// @desc    Search users by name or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q}%`;
    const users = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, role FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 10',
      [searchTerm, searchTerm]
    );
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const users = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, role FROM users ORDER BY name ASC'
    );
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, role, cabin_number AS cabinNumber, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
const updateUser = async (req, res) => {
  try {
    const { name, bio, profilePicture, coverPhoto, linkedin, github, portfolio } = req.body;
    const userId = req.params.id;
    const currentUserId = req.user.id || req.user._id;

    // Check if user is updating their own profile
    if (String(currentUserId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const fields = [];
    const params = [];
    if (name) { fields.push('name = ?'); params.push(name); }
    if (bio !== undefined) { fields.push('bio = ?'); params.push(bio); }
    if (profilePicture) { fields.push('profile_picture = ?'); params.push(profilePicture); }
    if (coverPhoto) { fields.push('cover_photo = ?'); params.push(coverPhoto); }
    if (linkedin !== undefined) { fields.push('linkedin = ?'); params.push(linkedin); }
    if (github !== undefined) { fields.push('github = ?'); params.push(github); }
    if (portfolio !== undefined) { fields.push('portfolio = ?'); params.push(portfolio); }

    if (fields.length > 0) {
      params.push(userId);
      await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const updated = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, linkedin, github, portfolio, role, cabin_number AS cabinNumber FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  searchUsers,
  getUsers,
  getUserById,
  updateUser
};