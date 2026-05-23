const { query } = require('../config/db');

const pruneExpiredAnnouncements = async () => {
  // Keep only the last 7 days of broadcasts in DB.
  await query(
    `DELETE FROM announcement_reads
      WHERE announcement_id IN (
        SELECT id FROM announcements WHERE created_at < NOW() - INTERVAL '7 days'
      )`
  );

  await query(`DELETE FROM announcements WHERE created_at < NOW() - INTERVAL '7 days'`);
};

const getAudienceScope = (roleValue) => {
  const role = String(roleValue || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isTeacherLike = role === 'teacher' || role === 'faculty' || role === 'dean';
  return { isAdmin, isTeacherLike };
};

const normalizeAnnouncementTarget = (rawTarget) => {
  const normalized = String(rawTarget || 'all').trim().toLowerCase();
  if (normalized === 'all' || normalized === 'all users' || normalized === 'everyone' || normalized === 'everybody') {
    return 'All';
  }
  if (normalized === 'student' || normalized === 'students') {
    return 'student';
  }
  if (normalized === 'teacher' || normalized === 'teachers' || normalized === 'faculty' || normalized === 'dean' || normalized === 'deans') {
    return 'faculty';
  }
  if (normalized === 'admin' || normalized === 'admins') {
    return 'admin';
  }
  return 'All';
};

// Create announcement (teachers and admins only)
exports.createAnnouncement = async (req, res) => {
  try {
    await pruneExpiredAnnouncements();

    const { title, content, target } = req.body;
    const normalizedTarget = normalizeAnnouncementTarget(target);
    const currentUserId = req.user.id || req.user._id;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    // Guard against accidental double-submit: same author+title+content+target in the last 30s.
    const recentDuplicate = await query(
      `SELECT id
         FROM announcements
        WHERE author_id = $1
          AND title = $2
          AND content = $3
          AND target = $4
          AND created_at >= NOW() - INTERVAL '30 seconds'
        ORDER BY created_at DESC
        LIMIT 1`,
      [currentUserId, title, content, normalizedTarget]
    );

    if (recentDuplicate.length) {
      const dupRows = await query(
        `SELECT a.id, a.title, a.content, a.target, FLOOR(EXTRACT(EPOCH FROM a.created_at) * 1000) AS "createdAt",
                u.id AS "authorId", u.name AS "authorName", u.profile_picture AS "authorAvatar", u.role AS "authorRole"
           FROM announcements a
           JOIN users u ON u.id = a.author_id
          WHERE a.id = $1
          LIMIT 1`,
        [recentDuplicate[0].id]
      );

      const announcement = {
        ...dupRows[0],
        author: {
          id: dupRows[0].authorId,
          name: dupRows[0].authorName,
          avatar: dupRows[0].authorAvatar,
          role: dupRows[0].authorRole,
        },
      };

      return res.status(200).json({
        message: 'Announcement already created recently',
        announcement,
      });
    }

    const result = await query(
      'INSERT INTO announcements (title, content, author_id, target) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, content, currentUserId, normalizedTarget]
    );

    const announcementId = result[0]?.id;
    
    const rows = await query(
          `SELECT a.id, a.title, a.content, a.target, FLOOR(EXTRACT(EPOCH FROM a.created_at) * 1000) AS "createdAt",
            u.id AS "authorId", u.name AS "authorName", u.profile_picture AS "authorAvatar", u.role AS "authorRole"
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
    await pruneExpiredAnnouncements();

    const currentUserId = req.user.id || req.user._id;
    let sql = `SELECT a.id, a.title, a.content, a.target, FLOOR(EXTRACT(EPOCH FROM a.created_at) * 1000) AS "createdAt",
              u.id AS "authorId", u.name AS "authorName", u.profile_picture AS "authorAvatar", u.role AS "authorRole",
                      EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS "isRead"
                 FROM announcements a
                 JOIN users u ON u.id = a.author_id
                 WHERE 1=1`;
    
    const params = [currentUserId];

    const { isAdmin, isTeacherLike } = getAudienceScope(req.user.role);
    if (!isAdmin) {
      if (isTeacherLike) {
        // Teachers/faculty/deans see: All + Teacher/Faculty targets.
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'teacher', 'teachers', 'faculty'))`;
      } else {
        // Students see: All + Student targets.
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'student', 'students'))`;
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
    await pruneExpiredAnnouncements();

    const currentUserId = req.user.id || req.user._id;
    let sql = `SELECT COUNT(*) AS "unreadCount" 
                 FROM announcements a
                 WHERE NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1)`;
    
    const params = [currentUserId];

    const { isAdmin, isTeacherLike } = getAudienceScope(req.user.role);
    if (!isAdmin) {
      if (isTeacherLike) {
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'teacher', 'teachers', 'faculty'))`;
      } else {
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'student', 'students'))`;
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
      const role = String(req.user.role || '').toLowerCase();
      if (role === 'teacher' || role === 'faculty' || role === 'dean') {
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'teacher', 'teachers', 'faculty'))`;
      } else {
        sql += ` AND (LOWER(a.target::text) IN ('all', 'all users', 'student', 'students'))`;
      }
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
    if (target !== undefined) { fields.push('target = $' + paramIndex); params.push(normalizeAnnouncementTarget(target)); paramIndex++; }

    if (fields.length > 0) {
      params.push(announcementId);
      const finalParamIndex = params.length;
      await query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = $${finalParamIndex}`, params);
    }

    const updated = await query(
      `SELECT a.*, u.name AS "authorName", u.profile_picture AS "authorAvatar", u.role AS "authorRole"
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
