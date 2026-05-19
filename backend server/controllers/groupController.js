const { query } = require('../config/db');

// Helper to get full group info
const getPopulatedGroup = async (groupId, userId) => {
  const rows = await query(
    `SELECT g.id, g.name, g.description, g.avatar, g.only_admins_can_message AS onlyAdminsCanMessage, g.created_at AS createdAt,
            u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture,
            gm.notification_setting AS notificationSetting, gm.last_read_id AS lastReadId
       FROM \`groups\` g
       JOIN users u ON u.id = g.created_by
       LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      WHERE g.id = ?
      LIMIT 1`,
    [userId, groupId]
  );
  
  if (!rows.length) return null;
  
  const group = rows[0];
  const members = await query(
    `SELECT gm.user_id AS id, gm.role, gm.notification_setting AS notificationSetting, u.name, u.email, u.profile_picture AS profilePicture
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?`,
    [group.id]
  );

  const messages = await query(
    `SELECT gm.id, gm.content, gm.type, gm.created_at AS createdAt,
            u.id AS senderId, u.name AS senderName, u.profile_picture AS senderAvatar
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = ?
      ORDER BY gm.created_at ASC`,
    [group.id]
  );

  // Calculate unread count
  const unreadRow = await query(
    'SELECT COUNT(*) AS cnt FROM group_messages WHERE group_id = ? AND id > ?',
    [group.id, group.lastReadId || 0]
  );

  return {
    ...group,
    unreadCount: unreadRow[0].cnt,
    createdBy: { id: group.creatorId, name: group.creatorName, email: group.creatorEmail, profilePicture: group.creatorProfilePicture },
    members: members.map(m => ({ user: { id: m.id, name: m.name, email: m.email, profilePicture: m.profilePicture }, role: m.role, notificationSetting: m.notificationSetting })),
    messages: messages.map(m => ({
      id: m.id,
      text: m.content,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt,
      timestamp: m.createdAt,
      sender: { id: m.senderId, name: m.senderName, avatar: m.senderAvatar }
    }))
  };
};

// @desc    Create a new group (faculty only)
// @route   POST /api/groups
// @access  Private/Faculty
const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const currentUserId = req.user.id || req.user._id;

    const result = await query(
      'INSERT INTO `groups` (name, description, created_by) VALUES (?, ?, ?)',
      [name, description, currentUserId]
    );

    const groupId = result.insertId;
    
    // Add creator as admin
    await query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, currentUserId, 'admin']
    );

    const group = await getPopulatedGroup(groupId, currentUserId);
    
    // Broadcast to initial members
    const io = req.app.get('io');
    if (io && group.members) {
      group.members.forEach(m => {
        io.to(`user:${m.user.id}`).emit('group_added_to', group);
      });
    }

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all groups
// @route   GET /api/groups
// @access  Private
const getGroups = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const groupsRows = await query(
      `SELECT g.id FROM \`groups\` g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
       ORDER BY g.created_at DESC`,
      [currentUserId]
    );

    const groups = await Promise.all(groupsRows.map(async (row) => {
      return await getPopulatedGroup(row.id, currentUserId);
    }));
    
    res.json(groups.filter(g => g !== null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Private
const getGroupById = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const group = await getPopulatedGroup(req.params.id, currentUserId);
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update group (admin only)
// @route   PUT /api/groups/:id
// @access  Private/Admin
const updateGroup = async (req, res) => {
  try {
    const { name, description, avatar, onlyAdminsCanMessage } = req.body;
    const currentUserId = req.user.id || req.user._id;
    
    const rows = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [req.params.id, currentUserId]);
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'User not authorized to update this group' });
    }
    
    // Build update query dynamically based on provided fields
    let updateFields = [];
    let queryParams = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      queryParams.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      queryParams.push(description);
    }
    if (avatar !== undefined) {
      updateFields.push('avatar = ?');
      queryParams.push(avatar);
    }
    if (onlyAdminsCanMessage !== undefined) {
      updateFields.push('only_admins_can_message = ?');
      queryParams.push(onlyAdminsCanMessage ? 1 : 0);
    }

    if (updateFields.length > 0) {
      queryParams.push(req.params.id);
      await query(
        `UPDATE \`groups\` SET ${updateFields.join(', ')} WHERE id = ?`,
        queryParams
      );
    }
    
    const updated = await getPopulatedGroup(req.params.id, currentUserId);

    // Broadcast update to all members
    const io = req.app.get('io');
    if (io && updated.members) {
      updated.members.forEach(m => {
        io.to(`user:${m.user.id}`).emit('group_updated', updated);
      });
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete group (admin only)
// @route   DELETE /api/groups/:id
// @access  Private/Admin
const deleteGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    
    const rows = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [req.params.id, currentUserId]);
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'User not authorized to delete this group' });
    }
    
    await query('DELETE FROM `groups` WHERE id = ?', [req.params.id]);
    res.json({ message: 'Group removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Join a group
// @route   PUT /api/groups/join/:id
// @access  Private
const joinGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const groupId = req.params.id;
    
    // Check if already a member
    const check = await query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, currentUserId]);
    if (check.length) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }
    
    await query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [req.params.id, currentUserId, 'member']
    );
    
    const updated = await getPopulatedGroup(req.params.id, currentUserId);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Leave a group
// @route   PUT /api/groups/leave/:id
// @access  Private
const leaveGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const groupId = req.params.id;

    // Check if member
    const check = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, currentUserId]);
    if (!check.length) {
      return res.status(400).json({ message: 'Not a member of this group' });
    }

    if (check[0].role === 'admin') {
      const admins = await query('SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND role = "admin"', [groupId]);
      if (admins[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot leave. You are the only admin. Promote someone else first or delete the group.' });
      }
    }
    // Fetch group name first to avoid cross-table collation mix in LIKE
    const groupRows = await query('SELECT name FROM `groups` WHERE id = ? LIMIT 1', [groupId]);
    const groupName = groupRows.length ? groupRows[0].name : '';

    await query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, currentUserId]
    );

    // Delete notification (including old ones without group_id by matching name)
    await query(`
      DELETE FROM notifications 
      WHERE user_id = ? 
      AND type = "GROUP_ADDED" 
      AND (group_id = ? OR content LIKE ?)
    `, [currentUserId, groupId, `%${groupName}%`]);
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${currentUserId}`).emit('delete_notification', { type: 'GROUP_ADDED', groupId: groupId });
    }

    // Fetch the updated group state and broadcast to remaining members so their count updates instantly
    const updated = await getPopulatedGroup(groupId, currentUserId);
    if (io && updated) {
      updated.members.forEach(m => {
        io.to(`user:${m.user.id}`).emit('group_updated', updated);
      });
    }
    
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add members to group
// @route   POST /api/groups/:id/members
// @access  Private
const addMembers = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userIds } = req.body; // Array of user IDs
    const currentUserId = req.user.id || req.user._id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No users specified' });
    }

    // 1. Check if group exists
    const groupRows = await query('SELECT name FROM `groups` WHERE id = ?', [groupId]);
    if (!groupRows.length) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const groupName = groupRows[0].name;

    // 2. Check if current user is admin
    const adminCheck = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, currentUserId]);
    if (!adminCheck.length || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    // 3. Add members and notify
    const io = req.app.get('io');
    await Promise.all(userIds.map(async (uid) => {
      // Check if already a member
      const exists = await query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, uid]);
      if (exists.length) return null;

      await query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, uid, 'member']);
      
      // Notify the user
      const notifResult = await query(
        'INSERT INTO notifications (user_id, type, content, group_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
        [uid, 'GROUP_ADDED', `You were added to group: ${groupName}`, groupId]
      );

      // Emit real-time notification
      if (io) {
        io.to(`user:${uid}`).emit('new_notification', {
          id: notifResult.insertId,
          type: 'GROUP_ADDED',
          content: `You were added to group: ${groupName}`,
          isRead: false,
          createdAt: new Date(),
          groupId: groupId
        });
      }
    }));

    const updated = await getPopulatedGroup(groupId, currentUserId);

    // Broadcast to added members so their list updates live
    if (io) {
      userIds.forEach(uid => {
        io.to(`user:${uid}`).emit('group_added_to', updated);
      });
      // Also notify existing members of the update
      updated.members.forEach(m => {
        if (!userIds.includes(m.user.id)) {
          io.to(`user:${m.user.id}`).emit('group_updated', updated);
        }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateNotificationSetting = async (req, res) => {
  try {
    const { setting } = req.body;
    const groupId = req.params.id;
    const currentUserId = req.user.id || req.user._id;

    if (!['all', 'mentions', 'off'].includes(setting)) {
      return res.status(400).json({ message: 'Invalid setting' });
    }

    await query(
      'UPDATE group_members SET notification_setting = ? WHERE group_id = ? AND user_id = ?',
      [setting, groupId, currentUserId]
    );

    res.json({ message: 'Notification setting updated', setting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const groupId = req.params.id;
    const currentUserId = req.user.id || req.user._id;

    // Get max ID
    const maxIdRow = await query('SELECT MAX(id) AS maxId FROM group_messages WHERE group_id = ?', [groupId]);
    const maxId = maxIdRow[0].maxId || 0;

    await query(
      'UPDATE group_members SET last_read_id = ? WHERE group_id = ? AND user_id = ?',
      [maxId, groupId, currentUserId]
    );

    // Also mark "added to group" notifications as read
    await query(
      'UPDATE notifications SET isRead = 1 WHERE user_id = ? AND type = "GROUP_ADDED" AND group_id = ?',
      [currentUserId, groupId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${currentUserId}`).emit('update_notification', { type: 'GROUP_ADDED', groupId: groupId, isRead: true });
      io.to(`user:${currentUserId}`).emit('group_marked_read', { groupId, lastReadId: maxId });
    }

    res.json({ message: 'Marked as read', lastReadId: maxId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id || req.user._id;

    // Check admin
    const adminCheck = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, currentUserId]);
    if (!adminCheck.length || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // Cannot remove self if only admin (already handled in leaveGroup but good to have)
    if (String(targetUserId) === String(currentUserId)) {
      const admins = await query('SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND role = "admin"', [groupId]);
      if (admins[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot remove yourself. You are the only admin.' });
      }
    }

    await query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
    
    // Delete notification (including old ones without group_id by matching name)
    const groupNameResult = await query('SELECT name FROM `groups` WHERE id = ?', [groupId]);
    const groupName = groupNameResult[0]?.name;

    await query(`
      DELETE FROM notifications 
      WHERE user_id = ? 
      AND type = "GROUP_ADDED" 
      AND (group_id = ? OR content LIKE ?)
    `, [targetUserId, groupId, `%${groupName}%`]);

    const updated = await getPopulatedGroup(groupId, currentUserId);
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('delete_notification', { 
        type: 'GROUP_ADDED', 
        groupId: groupId,
        groupName: groupName 
      });
      // Notify removed user to clear their group list
      io.to(`user:${targetUserId}`).emit('group_removed_from', { groupId });
      
      // Notify others
      if (updated) {
        updated.members.forEach(m => {
          io.to(`user:${m.user.id}`).emit('group_updated', updated);
        });
      }
    }

    res.json(updated || { message: 'Member removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId, role } = req.body;
    const currentUserId = req.user.id || req.user._id;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check admin
    const adminCheck = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, currentUserId]);
    if (!adminCheck.length || adminCheck[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change roles' });
    }

    await query('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?', [role, groupId, userId]);

    const updated = await getPopulatedGroup(groupId, currentUserId);
    const io = req.app.get('io');
    if (io && updated) {
      updated.members.forEach(m => {
        io.to(`user:${m.user.id}`).emit('group_updated', updated);
      });
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a message in a group
// @route   DELETE /api/groups/:id/messages/:msgId
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const { id: groupId, msgId } = req.params;
    const currentUserId = req.user.id || req.user._id;

    // Verify ownership
    const msg = await query('SELECT sender_id FROM group_messages WHERE id = ? AND group_id = ? LIMIT 1', [msgId, groupId]);
    if (!msg.length) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (String(msg[0].sender_id) !== String(currentUserId)) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await query('DELETE FROM group_messages WHERE id = ?', [msgId]);

    // Emit socket event to notify other group members to remove it
    const io = req.app.get('io');
    if (io) {
      const members = await query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
      members.forEach(m => {
        io.to(`user:${m.user_id}`).emit('group_message_deleted', { groupId, msgId });
      });
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting group message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  addMembers,
  removeMember,
  updateMemberRole,
  updateNotificationSetting,
  markAsRead,
  deleteMessage
};