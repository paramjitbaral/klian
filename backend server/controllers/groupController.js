const { query } = require('../config/db');

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

    const rows = await query(
      `SELECT g.id, g.name, g.description, g.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM \`groups\` g
         JOIN users u ON u.id = g.created_by
        WHERE g.id = ?
        LIMIT 1`,
      [groupId]
    );
    
    const group = rows[0];
    const members = await query(
      `SELECT gm.user_id AS id, gm.role, u.name, u.email, u.profile_picture AS profilePicture
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?`,
      [groupId]
    );

    res.status(201).json({
      ...group,
      createdBy: { id: group.creatorId, name: group.creatorName, email: group.creatorEmail, profilePicture: group.creatorProfilePicture },
      members: members.map(m => ({ user: { id: m.id, name: m.name, email: m.email, profilePicture: m.profilePicture }, role: m.role }))
    });
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
    const groupsRows = await query(
      `SELECT g.id, g.name, g.description, g.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM \`groups\` g
         JOIN users u ON u.id = g.created_by
        ORDER BY g.created_at DESC`
    );

    const groups = await Promise.all(groupsRows.map(async (group) => {
      const members = await query(
        `SELECT gm.user_id AS id, gm.role, u.name, u.email, u.profile_picture AS profilePicture
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?`,
        [group.id]
      );
      return {
        ...group,
        createdBy: { id: group.creatorId, name: group.creatorName, email: group.creatorEmail, profilePicture: group.creatorProfilePicture },
        members: members.map(m => ({ user: { id: m.id, name: m.name, email: m.email, profilePicture: m.profilePicture }, role: m.role }))
      };
    }));
    
    res.json(groups);
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
    const rows = await query(
      `SELECT g.id, g.name, g.description, g.created_at AS createdAt,
              u.id AS creatorId, u.name AS creatorName, u.email AS creatorEmail, u.profile_picture AS creatorProfilePicture
         FROM \`groups\` g
         JOIN users u ON u.id = g.created_by
        WHERE g.id = ?
        LIMIT 1`,
      [req.params.id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    const group = rows[0];
    const members = await query(
      `SELECT gm.user_id AS id, gm.role, u.name, u.email, u.profile_picture AS profilePicture
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?`,
      [group.id]
    );

    res.json({
      ...group,
      createdBy: { id: group.creatorId, name: group.creatorName, email: group.creatorEmail, profilePicture: group.creatorProfilePicture },
      members: members.map(m => ({ user: { id: m.id, name: m.name, email: m.email, profilePicture: m.profilePicture }, role: m.role }))
    });
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
    const { name, description } = req.body;
    const currentUserId = req.user.id || req.user._id;
    
    const rows = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [req.params.id, currentUserId]);
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'User not authorized to update this group' });
    }
    
    await query(
      'UPDATE `groups` SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );
    
    const updated = await query('SELECT * FROM `groups` WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
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

    const exists = await query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, currentUserId]);
    if (exists.length) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }
    
    await query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, currentUserId, 'member']);
    
    const members = await query(
      `SELECT gm.user_id AS id, gm.role, u.name, u.email, u.profile_picture AS profilePicture
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?`,
      [groupId]
    );
    
    res.json(members.map(m => ({ user: { id: m.id, name: m.name, email: m.email, profilePicture: m.profilePicture }, role: m.role })));
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

    const memberRow = await query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, currentUserId]);
    if (!memberRow.length) {
      return res.status(400).json({ message: 'Not a member of this group' });
    }
    
    if (memberRow[0].role === 'admin') {
      const adminCountRows = await query('SELECT COUNT(*) AS cnt FROM group_members WHERE group_id = ? AND role = "admin"', [groupId]);
      if (adminCountRows[0].cnt === 1) {
        return res.status(400).json({ message: 'Cannot leave group as the only admin. Transfer admin role first.' });
      }
    }
    
    await query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, currentUserId]);
    res.json({ message: 'Left the group successfully' });
  } catch (error) {
    console.error(error);
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
  leaveGroup
};