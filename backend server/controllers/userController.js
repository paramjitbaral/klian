const { query } = require('../config/db');

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

const getFileExtension = (url) => {
  if (!url || typeof url !== 'string') return '';
  const cleanUrl = url.split('?')[0].split('#')[0];
  const fileName = cleanUrl.split('/').pop() || '';
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return (extension || '').toLowerCase();
};

const normalizePostAttachment = (url) => {
  if (!url) {
    return { image: null, video: null, fileUrl: null };
  }

  const extension = getFileExtension(url);

  if (VIDEO_EXTENSIONS.has(extension)) {
    return { image: null, video: url, fileUrl: null };
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return { image: null, video: null, fileUrl: url };
  }

  return { image: url, video: null, fileUrl: null };
};

const formatUserPost = (row) => {
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();
  const attachment = normalizePostAttachment(row.image_url || row.image || row.mediaUrl);

  return {
    id: row.id,
    content: row.content || '',
    created_at: createdAt,
    createdAt,
    timestamp: createdAt,
    userId: row.userId || row.user_id,
    name: row.name,
    email: row.email,
    profilePicture: row.profilePicture,
    coverPhoto: row.coverPhoto,
    role: row.role,
    bio: row.bio,
    likes: Number(row.likes || row.likesCount || 0),
    comments: Number(row.comments || row.commentsCount || 0),
    isLiked: !!row.isLiked,
    ...attachment
  };
};

// @desc    Search users by name or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: 'Search query must be at least 1 character' });
    }

    const searchTerm = `${q}%`;
    const users = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, role FROM users WHERE name ILIKE $1 OR email ILIKE $2 LIMIT 10',
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
      'SELECT id, name, email, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, linkedin, github, portfolio, role, cabin_number AS cabinNumber, created_at AS createdAt FROM users WHERE id = $1 LIMIT 1',
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

// @desc    Get posts created by a user
// @route   GET /api/users/:id/posts
// @access  Private
const getUserPosts = async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.id,
              p.content,
              p.image_url,
              FLOOR(EXTRACT(EPOCH FROM p.created_at) * 1000) AS created_at,
              u.id AS userId,
              u.name,
              u.email,
              u.profile_picture AS profilePicture,
              u.cover_photo AS coverPhoto,
              u.role,
              u.bio,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comments,
              EXISTS(SELECT 1 FROM post_likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) AS isLiked
         FROM posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.user_id = $2
        ORDER BY p.created_at DESC, p.id DESC`,
      [req.user.id || req.user._id || 0, req.params.id]
    );

    res.json(rows.map(formatUserPost));
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
    if (name) { fields.push('name = $' + (params.length + 1)); params.push(name); }
    if (bio !== undefined) { fields.push('bio = $' + (params.length + 1)); params.push(bio); }
    if (profilePicture) { fields.push('profile_picture = $' + (params.length + 1)); params.push(profilePicture); }
    if (coverPhoto) { fields.push('cover_photo = $' + (params.length + 1)); params.push(coverPhoto); }
    if (linkedin !== undefined) { fields.push('linkedin = $' + (params.length + 1)); params.push(linkedin); }
    if (github !== undefined) { fields.push('github = $' + (params.length + 1)); params.push(github); }
    if (portfolio !== undefined) { fields.push('portfolio = $' + (params.length + 1)); params.push(portfolio); }

    if (fields.length > 0) {
      params.push(userId);
      await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    }

    const updated = await query(
      'SELECT id, name, email, profile_picture AS profilePicture, cover_photo AS coverPhoto, bio, linkedin, github, portfolio, role, cabin_number AS cabinNumber FROM users WHERE id = $1 LIMIT 1',
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
  getUserPosts,
  updateUser
};