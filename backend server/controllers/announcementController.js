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
      'INSERT INTO announcements (title, content, author_id, target) VALUES (?, ?, ?, ?)',
      [title, content, currentUserId, target || 'All']
    );

    const announcementId = result.insertId;
    
    const rows = await query(
      `SELECT a.id, a.title, a.content, a.target, DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
              u.id AS authorId, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole
         FROM announcements a
         JOIN users u ON u.id = a.author_id
        WHERE a.id = ?
        LIMIT 1`,
      [announcementId]
    );
    
    const announcement = {
      ...rows[0],
      author: { id: rows[0].authorId, name: rows[0].authorName, avatar: rows[0].authorAvatar, role: rows[0].authorRole }
    };

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
    let sql = `SELECT a.id, a.title, a.content, a.target, DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
                      u.id AS authorId, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole,
                      (SELECT COUNT(*) FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = ?) AS isRead
                 FROM announcements a
                 JOIN users u ON u.id = a.author_id`;
    
    const params = [currentUserId];

    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      const userRole = req.user.role === 'faculty' ? 'faculty' : 'student';
      sql += ' WHERE a.target = "All" OR a.target = ?';
      params.push(userRole);
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
                 WHERE NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = ?)`;
    
    const params = [currentUserId];

    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      const userRole = req.user.role === 'faculty' ? 'faculty' : 'student';
      sql += ' AND (a.target = "All" OR a.target = ?)';
      params.push(userRole);
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

    const exists = await query('SELECT 1 FROM announcement_reads WHERE announcement_id = ? AND user_id = ? LIMIT 1', [announcementId, currentUserId]);

    if (!exists.length) {
      await query('INSERT INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)', [announcementId, currentUserId]);
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

// Delete announcement (author or admin only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const currentUserId = req.user.id || req.user._id;

    const rows = await query('SELECT author_id FROM announcements WHERE id = ? LIMIT 1', [announcementId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    if (String(rows[0].author_id) !== String(currentUserId) && req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this announcement' });
    }

    await query('DELETE FROM announcements WHERE id = ?', [announcementId]);

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

    const rows = await query('SELECT author_id FROM announcements WHERE id = ? LIMIT 1', [announcementId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    if (String(rows[0].author_id) !== String(currentUserId) && req.user.role !== 'Admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this announcement' });
    }

    const fields = [];
    const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (content) { fields.push('content = ?'); params.push(content); }
    if (target) { fields.push('target = ?'); params.push(target); }

    if (fields.length > 0) {
      params.push(announcementId);
      await query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const updated = await query(
      `SELECT a.*, u.name AS authorName, u.profile_picture AS authorAvatar, u.role AS authorRole
         FROM announcements a
         JOIN users u ON u.id = a.author_id
        WHERE a.id = ?`,
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
