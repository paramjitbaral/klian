const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

// Helper to save base64 file to uploads folder
const saveFile = (base64String, originalName = null) => {
  if (!base64String || !base64String.startsWith('data:')) return base64String;

  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const mimeType = matches[1];
    let extension = 'bin';
    
    // Map common mime types to extensions
    if (mimeType.includes('jpeg')) extension = 'jpg';
    else if (mimeType.includes('png')) extension = 'png';
    else if (mimeType.includes('gif')) extension = 'gif';
    else if (mimeType.includes('pdf')) extension = 'pdf';
    else if (mimeType.includes('msword')) extension = 'doc';
    else if (mimeType.includes('officedocument.wordprocessingml.document')) extension = 'docx';
    else if (mimeType.includes('officedocument.spreadsheetml.sheet')) extension = 'xlsx';
    else if (mimeType.includes('officedocument.presentationml.presentation')) extension = 'pptx';
    else {
      extension = mimeType.split('/')[1] || 'bin';
    }

    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    // Use original name if provided, otherwise generate one
    let filename;
    if (originalName) {
      // Sanitize: remove non-alphanumeric except dots/dashes/underscores
      const cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      filename = `${Date.now()}-${cleanName}`;
    } else {
      filename = `post-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
    }
    
    const uploadDir = path.join(__dirname, '../uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    return `/uploads/${filename}`;
  } catch (error) {
    console.error('[FileSave] Error:', error);
    return null;
  }
};

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
    const { content, image, fileName, isBroadcast } = req.body;

    // Process file if provided (convert base64 to file) - handles images and docs
    const imageUrl = image ? saveFile(image, fileName) : null;

    // Validate that at least content or image is provided
    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ message: 'Post must have either content or an image' });
    }

    // If it's a broadcast, check if user is faculty
    const isPrivileged = ['Teacher', 'Dean', 'Admin'].includes(req.user.role);
    if (isBroadcast && !isPrivileged) {
      return res.status(403).json({ message: 'Only faculty can create broadcasts' });
    }
    const result = await query(
      'INSERT INTO posts (user_id, content, image_url, is_broadcast) VALUES (?, ?, ?, ?)',
      [req.user.id || req.user._id, content || '', imageUrl, !!isBroadcast]
    );
    const postId = result.insertId;
    const rows = await query(
      `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
              UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
                UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
                UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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
      ? encodeCursor({ 
          createdAt: items[items.length - 1].created_at, 
          id: items[items.length - 1].id 
        })
      : null;

    res.json({ items, nextCursor, hasMore });
  } catch (error) {
    console.error('[API] getPosts ERROR:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// @desc    Get trending hashtags
// @route   GET /api/posts/trending-hashtags
// @access  Private
const getTrendingHashtags = async (req, res) => {
  try {
    const rows = await query(
      `SELECT content FROM posts ORDER BY created_at DESC LIMIT 1000`
    );
    
    const tagData = {};
    rows.forEach(row => {
      if (row.content) {
        const matches = row.content.match(/#[\w]+/g);
        if (matches) {
          matches.forEach(tag => {
            const lowerTag = tag.toLowerCase();
            if (!tagData[lowerTag]) {
              tagData[lowerTag] = { tag: tag, count: 0 };
            }
            tagData[lowerTag].count += 1;
          });
        }
      }
    });

    const sortedHashtags = Object.values(tagData)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json(sortedHashtags);
  } catch (error) {
    console.error('[API] getTrendingHashtags ERROR:', error);
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
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
                UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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
        `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
                UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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
      ? encodeCursor({ createdAt: items[items.length - 1].created_at, id: items[items.length - 1].id })
      : null;
    res.json({ 
      items, 
      nextCursor, 
      hasMore 
    });
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
      `SELECT p.id, p.content, p.image_url AS image, p.is_broadcast AS isBroadcast, 
              UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at,
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

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = async (req, res) => {
  try {
    const { content } = req.body;
    console.log(`[PostUpdate] Attempting to update post ${req.params.id} by user ${req.user.id || req.user._id}`);

    const rows = await query('SELECT user_id FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      console.log(`[PostUpdate] Post ${req.params.id} not found in DB`);
      return res.status(404).json({ message: 'Post not found' });
    }

    const ownerId = rows[0].user_id;
    const isOwner = String(ownerId) === String(req.user.id || req.user._id);
    const isPrivileged = ['Teacher', 'Dean', 'Admin'].includes(req.user.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'You are not authorized to edit this post' });
    }

    await query('UPDATE posts SET content = ? WHERE id = ?', [content, req.params.id]);
    res.json({ message: 'Post updated' });
  } catch (error) {
    console.error('[PostUpdate] Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    console.log(`[PostDelete] Attempting to delete post ${req.params.id} by user ${req.user.id || req.user._id}`);

    const rows = await query('SELECT user_id FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) {
      console.log(`[PostDelete] Post ${req.params.id} not found in DB`);
      return res.status(404).json({ message: 'Post not found' });
    }

    const ownerId = rows[0].user_id;
    const isOwner = String(ownerId) === String(req.user.id || req.user._id);
    const isPrivileged = ['Teacher', 'Dean', 'Admin'].includes(req.user.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'You are not authorized to delete this post' });
    }

    await query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post removed' });
  } catch (error) {
    console.error('[PostDelete] Error:', error);
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
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('post_update', { 
        type: 'LIKE_CHANGE', 
        postId: req.params.id, 
        likesCount: count[0].cnt 
      });
    }

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
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('post_update', { 
        type: 'LIKE_CHANGE', 
        postId: req.params.id, 
        likesCount: count[0].cnt 
      });
    }

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
    
    // Get total comment count for real-time update
    const countRows = await query('SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = ?', [req.params.id]);
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('post_update', { 
        type: 'COMMENT_CHANGE', 
        postId: req.params.id, 
        commentCount: countRows[0].cnt 
      });
    }

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
  updatePost,
  getPosts,
  getBroadcasts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  commentOnPost,
  deleteComment,
  likeComment,
  unlikeComment,
  getTrendingHashtags
};