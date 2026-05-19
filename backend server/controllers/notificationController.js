const { query } = require('../config/db');

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;

    const rows = await query(
      `SELECT n.id, n.type, n.post_id AS postId, n.comment_id AS commentId, n.group_id AS groupId, n.content, n.is_read AS isRead, n.created_at AS createdAt,
              a.id AS actorId, a.name AS actorName, a.profile_picture AS actorAvatar,
              pc.text AS commentText,
              p.content AS postContent, p.image_url AS postImage
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_id
         LEFT JOIN post_comments pc ON pc.id = n.comment_id
         LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50`,
      [currentUserId]
    );

    const notifications = rows.map(n => ({
      id: n.id,
      type: n.type,
      postId: n.postId,
      commentId: n.commentId,
      groupId: n.groupId,
      content: n.content,
      commentText: n.commentText,
      postPreview: {
        content: n.postContent,
        image: n.postImage
      },
      isRead: !!n.isRead,
      createdAt: n.createdAt,
      actor: n.actorId ? {
        id: n.actorId,
        name: n.actorName,
        avatar: n.actorAvatar
      } : null
    }));

    res.json(notifications);
  } catch (error) {
    console.error('[Notifications] Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [currentUserId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Notifications] Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markByType = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { type } = req.params;
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = ?', [currentUserId, type]);
    res.json({ message: `Notifications of type ${type} marked as read` });
  } catch (error) {
    console.error('[Notifications] Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to create a notification
const createNotification = async (userId, actorId, type, postId = null, commentId = null, groupId = null, options = {}) => {
  try {
    const { allowSelf = false, content = null } = options;

    // Don't notify if user is performing action on their own post/comment unless explicitly allowed
    if (!allowSelf && actorId !== null && actorId !== undefined && String(userId) === String(actorId)) return null;

    const result = await query(
      'INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id, group_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())',
      [userId, actorId, type, postId, commentId, groupId, content]
    );
    
    const notifId = result.insertId;
    
    // Fetch formatted notif for socket emission
    const rows = await query(
      `SELECT n.id, n.type, n.post_id AS postId, n.comment_id AS commentId, n.group_id AS groupId, n.is_read AS isRead, n.created_at AS createdAt,
              a.id AS actorId, a.name AS actorName, a.profile_picture AS actorAvatar,
              pc.text AS commentText,
              p.content AS postContent, p.image_url AS postImage
         FROM notifications n
         JOIN users a ON a.id = n.actor_id
         LEFT JOIN post_comments pc ON pc.id = n.comment_id
         LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.id = ?
        LIMIT 1`,
      [notifId]
    );

    if (!rows.length) return null;
    const n = rows[0];
    
    return {
      id: n.id,
      userId: userId, // Recipient ID for filtering on frontend
      type: n.type,
      postId: n.postId,
      commentId: n.commentId,
      content: content || n.content,
      commentText: n.commentText,
      postPreview: {
        content: n.postContent,
        image: n.postImage
      },
      isRead: !!n.isRead,
      createdAt: n.createdAt,
      actor: {
        id: n.actorId,
        name: n.actorName,
        avatar: n.actorAvatar
      }
    };
  } catch (error) {
    console.error('[Notifications] Create Error:', error);
    return null;
  }
};

// Helper to delete a notification
const deleteNotification = async (type, postId, actorId, commentId = null) => {
  try {
    let whereClause = 'type = ? AND post_id = ? AND actor_id = ?';
    let params = [type, postId, actorId];
    
    if (commentId) {
      whereClause += ' AND comment_id = ?';
      params.push(commentId);
    }

    // Find the most recent notification matching these criteria
    const findSql = `SELECT id, user_id FROM notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT 1`;
    const rows = await query(findSql, params);
    
    if (!rows.length) {
      console.log(`[Notifications] No matching notification found to delete for type=${type}, postId=${postId}, actorId=${actorId}`);
      return null;
    }
    
    const notifId = rows[0].id;
    const recipientId = rows[0].user_id;

    // Delete it by ID to be precise
    await query('DELETE FROM notifications WHERE id = ?', [notifId]);
    
    console.log(`[Notifications] Successfully deleted notification ${notifId} for recipient ${recipientId}`);
    return { id: notifId, recipientId };
  } catch (error) {
    console.error('[Notifications] Delete Error:', error);
    return null;
  }
};

// @desc    Delete a notification by ID
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotificationById = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notifId = req.params.id;
    
    // Check ownership
    const rows = await query('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [notifId, userId]);
    if (!rows.length) return res.status(404).json({ message: 'Notification not found or unauthorized' });

    await query('DELETE FROM notifications WHERE id = ?', [notifId]);
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('[Notifications] Delete Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markAllAsRead,
  markByType,
  createNotification,
  deleteNotification,
  deleteNotificationById
};
