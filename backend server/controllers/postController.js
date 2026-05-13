const { query } = require('../config/db');

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function decodeCursor(str) {
  try { return JSON.parse(Buffer.from(str, 'base64url').toString()); } catch { return null; }
}

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const { content, image, isBroadcast } = req.body;

    // Validate that at least content or image is provided
    if (!content?.trim() && !image) {
      return res.status(400).json({ message: 'Post must have either content or an image' });
    }

    // If it's a broadcast, check if user is faculty
    if (isBroadcast && req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Only faculty can create broadcasts' });
    }
    const result = await query(
      'INSERT INTO posts (user_id, content, image_url, is_broadcast) VALUES (?, ?, ?, ?)',
      [req.user.id || req.user._id, content || '', image || null, !!isBroadcast]
    );
    const postId = result.insertId;
    const rows = await query(
      `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
              u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio
         FROM posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.id = ?
        LIMIT 1`,
      [postId]
    );
    const created = rows[0];
    const io = req.app.get('io');
    if (io) io.emit('new-post', created);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
const getPosts = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;

    let rows;
    if (cursor && cursor.createdAt && cursor.id) {
      rows = await query(
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
                u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE (p.created_at < ? OR (p.created_at = ? AND p.id < ?))
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ?`,
        [cursor.createdAt, cursor.createdAt, cursor.id, limit + 1]
      );
    } else {
      rows = await query(
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
                u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio
           FROM posts p
           JOIN users u ON u.id = p.user_id
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ?`,
        [limit + 1]
      );
    }

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = items.length
      ? encodeCursor({ createdAt: items[items.length - 1].created_at || items[items.length - 1].createdAt, id: items[items.length - 1].id })
      : null;

    res.json({ items, nextCursor, hasMore });
  } catch (error) {
    console.error('[API] getPosts ERROR:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// @desc    Get broadcasts only
// @route   GET /api/posts/broadcasts
// @access  Private
const getBroadcasts = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    let rows;
    if (cursor && cursor.createdAt && cursor.id) {
      rows = await query(
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
                u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE p.is_broadcast = 1 AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ?`,
        [cursor.createdAt, cursor.createdAt, cursor.id, limit + 1]
      );
    } else {
      rows = await query(
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
                u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE p.is_broadcast = 1
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ?`,
        [limit + 1]
      );
    }
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = items.length
      ? encodeCursor({ createdAt: items[items.length - 1].created_at || items[items.length - 1].createdAt, id: items[items.length - 1].id })
      : null;
    res.json({ items, nextCursor, hasMore });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get post by ID
// @route   GET /api/posts/:id
// @access  Private
const getPostById = async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, p.created_at,
              u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture, u.cover_photo AS coverPhoto, u.role, u.bio,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likesCount,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS commentsCount
         FROM posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.id = ?
        LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Post not found' });
    const post = rows[0];
    res.json({ ...post, likes: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const rows = await query('SELECT user_id FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Post not found' });
    const ownerId = rows[0].user_id;
    if (String(ownerId) !== String(req.user.id || req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }
    await query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Like a post
// @route   PUT /api/posts/like/:id
// @access  Private
const likePost = async (req, res) => {
  try {
    const postRow = await query('SELECT id FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!postRow.length) return res.status(404).json({ message: 'Post not found' });
    const userId = req.user.id || req.user._id;
    const exists = await query('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1', [req.params.id, userId]);
    if (exists.length) return res.status(400).json({ message: 'Post already liked' });
    await query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, userId]);
    const count = await query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?', [req.params.id]);
    res.json({ likesCount: count[0].cnt });
  } catch (error) {
    console.error('Error in likePost:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Unlike a post
// @route   PUT /api/posts/unlike/:id
// @access  Private
const unlikePost = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const exists = await query('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1', [req.params.id, userId]);
    if (!exists.length) return res.status(400).json({ message: 'Post has not yet been liked' });
    await query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, userId]);
    const count = await query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?', [req.params.id]);
    res.json({ likesCount: count[0].cnt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Comment on a post
// @route   POST /api/posts/comment/:id
// @access  Private
const commentOnPost = async (req, res) => {
  try {
    const postRow = await query('SELECT id FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!postRow.length) return res.status(404).json({ message: 'Post not found' });
    const userId = req.user.id || req.user._id;
    const text = req.body.text || '';
    await query('INSERT INTO post_comments (post_id, user_id, text) VALUES (?, ?, ?)', [req.params.id, userId, text]);
    const comments = await query(
      `SELECT c.id, c.text, c.created_at, u.id AS userId, u.name, u.email, u.profile_picture AS profilePicture
         FROM post_comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 50`,
      [req.params.id]
    );
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete comment
// @route   DELETE /api/posts/comment/:id/:comment_id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rows = await query('SELECT user_id FROM post_comments WHERE id = ? AND post_id = ? LIMIT 1', [req.params.comment_id, req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Post or comment not found' });
    const ownerId = rows[0].user_id;
    if (String(ownerId) !== String(userId) && req.user.role !== 'faculty') {
      return res.status(401).json({ message: 'User not authorized' });
    }
    await query('DELETE FROM post_comments WHERE id = ? AND post_id = ?', [req.params.comment_id, req.params.id]);
    const comments = await query('SELECT id, text FROM post_comments WHERE post_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', [req.params.id]);
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Like a comment
// @route   PUT /api/posts/comment/like/:id/:comment_id
// @access  Private
const likeComment = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const exists = await query('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ? LIMIT 1', [req.params.comment_id, userId]);
    if (exists.length) return res.status(400).json({ message: 'Comment already liked' });
    await query('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [req.params.comment_id, userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Unlike a comment
// @route   PUT /api/posts/comment/unlike/:id/:comment_id
// @access  Private
const unlikeComment = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    await query('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [req.params.comment_id, userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPost,
  getPosts,
  getBroadcasts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  commentOnPost,
  deleteComment,
  likeComment,
  unlikeComment
};