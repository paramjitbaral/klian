const { query } = require('../config/db');

// @desc    Send a message to another user
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { recipient, content, type, postId } = req.body;
    const currentUserId = req.user.id || req.user._id;

    // Check if recipient exists
    const recipientRows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [recipient]);
    if (!recipientRows.length) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const result = await query(
      'INSERT INTO messages (sender_id, recipient_id, content, type, post_id) VALUES (?, ?, ?, ?, ?)',
      [currentUserId, recipient, content || '', type || 'text', postId || null]
    );

    const messageId = result.insertId;
    
    // Fetch populated message
    const rows = await query(
      `SELECT m.id, m.content, m.type, m.post_id AS postId, m.read, m.created_at AS createdAt,
              s.id AS senderId, s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
              r.id AS recipientId, r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture
         FROM messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
        WHERE m.id = ?
        LIMIT 1`,
      [messageId]
    );
    
    const msg = rows[0];
    const formatted = {
      _id: msg.id,
      id: msg.id,
      content: msg.content,
      type: msg.type,
      postId: msg.postId,
      read: !!msg.read,
      createdAt: msg.createdAt,
      sender: { _id: msg.senderId, id: msg.senderId, name: msg.senderName, email: msg.senderEmail, profilePicture: msg.senderProfilePicture },
      recipient: { _id: msg.recipientId, id: msg.recipientId, name: msg.recipientName, email: msg.recipientEmail, profilePicture: msg.recipientProfilePicture }
    };

    res.status(201).json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get messages between current user and another user
// @route   GET /api/messages/:userId
// @access  Private
const getMessagesWith = async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user.id || req.user._id;

    // Find messages where current user is either sender or recipient
    const rows = await query(
      `SELECT m.id, m.content, m.type, m.post_id AS postId, m.read, m.created_at AS createdAt,
              s.id AS senderId, s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
              r.id AS recipientId, r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture,
              p.content AS postContent, p.image_url AS postImage, p.created_at AS postCreatedAt,
              pu.name AS postUserName, pu.profile_picture AS postUserProfilePicture
         FROM messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         LEFT JOIN posts p ON p.id = m.post_id
         LEFT JOIN users pu ON pu.id = p.user_id
        WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
        ORDER BY m.created_at ASC`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );
    
    const messages = rows.map(msg => ({
      _id: msg.id,
      id: msg.id,
      content: msg.content,
      type: msg.type,
      postId: msg.postId ? {
        _id: msg.postId,
        content: msg.postContent,
        image: msg.postImage,
        createdAt: msg.postCreatedAt,
        user: { name: msg.postUserName, profilePicture: msg.postUserProfilePicture }
      } : null,
      read: !!msg.read,
      createdAt: msg.createdAt,
      sender: { _id: msg.senderId, id: msg.senderId, name: msg.senderName, email: msg.senderEmail, profilePicture: msg.senderProfilePicture },
      recipient: { _id: msg.recipientId, id: msg.recipientId, name: msg.recipientName, email: msg.recipientEmail, profilePicture: msg.recipientProfilePicture }
    }));

    // Mark messages as read if current user is recipient
    await query(
      'UPDATE messages SET `read` = 1 WHERE recipient_id = ? AND sender_id = ? AND `read` = 0',
      [currentUserId, otherUserId]
    );
    
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all conversations of current user
// @route   GET /api/messages
// @access  Private
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;

    // Get the last message of each conversation
    const rows = await query(
      `SELECT m1.*, 
              s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
              r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture
         FROM messages m1
         JOIN (
           SELECT MAX(id) as lastId
           FROM messages
           WHERE sender_id = ? OR recipient_id = ?
           GROUP BY LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
         ) m2 ON m1.id = m2.lastId
         JOIN users s ON s.id = m1.sender_id
         JOIN users r ON r.id = m1.recipient_id
         ORDER BY m1.created_at DESC`,
      [currentUserId, currentUserId]
    );
    
    const conversations = rows.map(msg => {
      const otherUser = msg.sender_id == currentUserId 
        ? { _id: msg.recipient_id, id: msg.recipient_id, name: msg.recipientName, email: msg.recipientEmail, profilePicture: msg.recipientProfilePicture } 
        : { _id: msg.sender_id, id: msg.sender_id, name: msg.senderName, email: msg.senderEmail, profilePicture: msg.senderProfilePicture };
      
      return {
        user: otherUser,
        lastMessage: {
          id: msg.id,
          content: msg.content,
          type: msg.type,
          createdAt: msg.created_at,
          read: !!msg.read,
          sender: msg.sender_id,
          recipient: msg.recipient_id
        },
        unread: Number(msg.recipient_id) === Number(currentUserId) && Number(msg.read) === 0
      };
    });
    
    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendMessage,
  getMessagesWith,
  getConversations,
  
  // @desc    Share a post via message
  // @route   POST /api/messages/share
  // @access  Private
  sharePost: async (req, res) => {
    try {
      const { recipient, postId, message } = req.body;
      const currentUserId = req.user.id || req.user._id;

      if (!recipient || !postId) {
        return res.status(400).json({ message: 'Recipient and postId are required' });
      }

      const recipientRows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [recipient]);
      if (!recipientRows.length) {
        return res.status(404).json({ message: 'Recipient not found' });
      }

      const result = await query(
        'INSERT INTO messages (sender_id, recipient_id, content, type, post_id) VALUES (?, ?, ?, ?, ?)',
        [currentUserId, recipient, message || '', 'post', postId]
      );

      const messageId = result.insertId;
      
      // Fetch populated message with post details
      const rows = await query(
        `SELECT m.id, m.content, m.type, m.post_id AS postId, m.read, m.created_at AS createdAt,
                s.id AS senderId, s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
                r.id AS recipientId, r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture,
                p.content AS postContent, p.image_url AS postImage, p.created_at AS postCreatedAt,
                pu.name AS postUserName, pu.profile_picture AS postUserProfilePicture
           FROM messages m
           JOIN users s ON s.id = m.sender_id
           JOIN users r ON r.id = m.recipient_id
           LEFT JOIN posts p ON p.id = m.post_id
           LEFT JOIN users pu ON pu.id = p.user_id
          WHERE m.id = ?
          LIMIT 1`,
        [messageId]
      );
      
      const msg = rows[0];
      const formatted = {
        _id: msg.id,
        id: msg.id,
        content: msg.content,
        type: msg.type,
        postId: {
          id: msg.postId,
          content: msg.postContent,
          image: msg.postImage,
          createdAt: msg.postCreatedAt,
          user: { name: msg.postUserName, profilePicture: msg.postUserProfilePicture }
        },
        read: !!msg.read,
        createdAt: msg.createdAt,
        sender: { _id: msg.senderId, id: msg.senderId, name: msg.senderName, email: msg.senderEmail, profilePicture: msg.senderProfilePicture },
        recipient: { _id: msg.recipientId, id: msg.recipientId, name: msg.recipientName, email: msg.recipientEmail, profilePicture: msg.recipientProfilePicture }
      };
      
      res.status(201).json(formatted);
    } catch (error) {
      console.error('Error sharing post via message:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};