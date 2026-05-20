const { query } = require('../config/db');

// Create announcement (teachers and admins only)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, target } = req.body;
    const currentUserId = req.user.id || req.user._id;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const result = await query(
      'INSERT INTO announcements (title, content, author_id, target) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, content, currentUserId, target || 'All']
    );

    const announcementId = result[0]?.id;
    
    const rows = await query(
      `SELECT a.id, a.title, a.content, a.target, FLOOR(EXTRACT(EPOCH FROM a.created_at) * 1000) AS createdAt,
              u.id AS authorId, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole
         FROM announcements a
         JOIN users u ON u.id = a.author_id
        WHERE a.id = $1
        LIMIT 1`,
      [announcementId]
    );
    
    const announcement = {
      ...rows[0],
      author: { id: rows[0].authorId, name: rows[0].authorName, avatar: rows[0].authorAvatar, role: rows[0].authorRole }
    };

    // Emit to all connected clients for real-time feed updates
    const io = req.app.get('io');
    if (io) io.emit('announcement-created', announcement);

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      message: 'Server error while creating announcement',
      error: error.message
    });
  }
};

// Get all announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    let sql = `SELECT a.id, a.title, a.content, a.target, FLOOR(EXTRACT(EPOCH FROM a.created_at) * 1000) AS createdAt,
                      u.id AS authorId, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole,
                      (SELECT COUNT(*) FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS isRead
                 FROM announcements a
                 WHERE NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1)`;
    
    const params = [currentUserId];

    // Admin sees all announcements (no WHERE filter)
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      const role = req.user.role;
      if (role === 'Teacher') {
        // Teachers see: All Users + Teachers
        sql += ` WHERE (LOWER(a.target) IN ('all', 'all users', 'teacher', 'teachers'))`;
      } else {
        // Students only see: All Users + Students
        sql += ` WHERE (LOWER(a.target) IN ('all', 'all users', 'student', 'students'))`;
      }
    }
    
    sql += ' ORDER BY a.created_at DESC';
    
    const rows = await query(sql, params);

    const announcements = rows.map(row => ({
      ...row,
      author: { id: row.authorId, name: row.authorName, avatar: row.authorAvatar, role: row.authorRole },
      isRead: !!row.isRead
    }));

    res.json({ announcements });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      message: 'Server error while fetching announcements',
      error: error.message
    });
  }
};

// Get unread announcements count
exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    let sql = `SELECT COUNT(*) AS unreadCount 
                 FROM announcements a
                 WHERE NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1)`;
    
    const params = [currentUserId];

    // Admin sees all (no filter)
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      const role = req.user.role;
      if (role === 'Teacher') {
        sql += ` AND (LOWER(a.target) IN ('all', 'all users', 'teacher', 'teachers'))`;
      } else {
        sql += ` AND (LOWER(a.target) IN ('all', 'all users', 'student', 'students'))`;
      }
    }
    
    const rows = await query(sql, params);

    res.json({
      unreadCount: rows[0].unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      message: 'Server error while fetching unread count',
      error: error.message
    });
  }
};

// Mark announcement as read
exports.markAsRead = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const currentUserId = req.user.id || req.user._id;

    const exists = await query('SELECT 1 FROM announcement_reads WHERE announcement_id = $1 AND user_id = $2 LIMIT 1', [announcementId, currentUserId]);

    if (!exists.length) {
      await query('INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1, $2)', [announcementId, currentUserId]);
    }

    res.json({
      message: 'Announcement marked as read'
    });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    res.status(500).json({
      message: 'Server error while marking announcement as read',
      error: error.message
    });
  }
};

// Mark all announcements as read for current user
exports.markAllAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    
    // Insert into announcement_reads for all announcements the user hasn't read yet
    // and that are targeted to them
    let sql = `INSERT INTO announcement_reads (announcement_id, user_id)
               SELECT a.id, $1 
                 FROM announcements a
                WHERE NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $2)`;
    
    const params = [currentUserId, currentUserId];

    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      const userRole = req.user.role === 'faculty' ? 'faculty' : 'student';
      sql += ' AND (a.target = $3 OR a.target = $4)';
      params.push('All', userRole);
    }

    await query(sql, params);

    res.json({ message: 'All announcements marked as read' });
  } catch (error) {
    console.error('Error marking all announcements as read:', error);
    res.status(500).json({
      message: 'Server error while marking all as read',
      error: error.message
    });
  }
};

// Delete announcement (author or admin only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const currentUserId = req.user.id || req.user._id;

    const rows = await query('SELECT author_id FROM announcements WHERE id = $1 LIMIT 1', [announcementId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    if (String(rows[0].author_id) !== String(currentUserId) && req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this announcement' });
    }

    // First delete associated reads to avoid foreign key constraints
    await query('DELETE FROM announcement_reads WHERE announcement_id = $1', [announcementId]);
    
    // Then delete the announcement itself
    await query('DELETE FROM announcements WHERE id = $1', [announcementId]);

    // Emit to all connected clients so their feeds update instantly
    const io = req.app.get('io');
    if (io) io.emit('announcement-deleted', { id: announcementId });

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      message: 'Server error while deleting announcement',
      error: error.message
    });
  }
};

// Update announcement (author or admin only)
exports.updateAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { title, content, target } = req.body;
    const currentUserId = req.user.id || req.user._id;

    const rows = await query('SELECT author_id FROM announcements WHERE id = $1 LIMIT 1', [announcementId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    if (String(rows[0].author_id) !== String(currentUserId) && req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this announcement' });
    }

    const fields = [];
    const params = [];
    let paramIndex = 1;
    if (title) { fields.push('title = $' + paramIndex); params.push(title); paramIndex++; }
    if (content) { fields.push('content = $' + paramIndex); params.push(content); paramIndex++; }
    if (target) { fields.push('target = $' + paramIndex); params.push(target); paramIndex++; }

    if (fields.length > 0) {
      params.push(announcementId);
      const finalParamIndex = params.length;
      await query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = $${finalParamIndex}`, params);
    }

    const updated = await query(
      `SELECT a.*, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole
         FROM announcements a
         JOIN users u ON u.id = a.author_id
        WHERE a.id = $1`,
      [announcementId]
    );

    res.json({
      message: 'Announcement updated successfully',
      announcement: updated[0]
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      message: 'Server error while updating announcement',
      error: error.message
    });
  }
};
