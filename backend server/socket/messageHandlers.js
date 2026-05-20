const { query } = require('../config/db');

const setupMessageHandlers = (io, socket, redis) => {
  console.log('Setting up message handlers for socket:', socket.id);
  
  // Handle private messages
  socket.on('private-message', async ({ senderId, recipientId, content, type = 'text', postId }) => {
    console.log('Received private message:', { senderId, recipientId, content, type, postId });
    
    // ENFORCE JWT SENDER AUTHENTICATION
    if (!socket.decodedUserId || String(senderId) !== String(socket.decodedUserId)) {
      console.warn(`Blocked spoofed message sender: ${socket.decodedUserId} tried to send as ${senderId}`);
      socket.emit('message-error', { error: 'Unauthorized: Sender identity mismatch' });
      return;
    }

    try {
      // Validate sender exists
      const sender = await query('SELECT id, name, email, profile_picture AS profilePicture FROM users WHERE id = $1 LIMIT 1', [senderId]);
      if (!sender.length) {
        console.error('Sender not found:', senderId);
        socket.emit('message-error', { error: 'Sender not found' });
        return;
      }

      // Validate recipient exists
      const recipient = await query('SELECT id, name, email, profile_picture AS profilePicture FROM users WHERE id = $1 LIMIT 1', [recipientId]);
      if (!recipient.length) {
        console.error('Recipient not found:', recipientId);
        socket.emit('message-error', { error: 'Recipient not found' });
        return;
      }

      // Create and save message
      const result = await query(
        'INSERT INTO messages (sender_id, recipient_id, content, type, post_id, read) VALUES ($1, $2, $3, $4, $5, false) RETURNING id',
        [senderId, recipientId, content, type, postId || null]
      );
      const msgId = result[0]?.id;

      // Load populated
      const rows = await query(
        `SELECT m.id, m.content, m.type, m.post_id AS postId, m.read, m.created_at,
                s.id AS senderId, s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
                r.id AS recipientId, r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture
           FROM messages m
           JOIN users s ON s.id = m.sender_id
           JOIN users r ON r.id = m.recipient_id
          WHERE m.id = $1 LIMIT 1`,
        [msgId]
      );
      const row = rows[0];
      const populatedMessage = {
        _id: row.id,
        content: row.content,
        type: row.type,
        postId: row.postId,
        read: row.read === true,
        createdAt: row.created_at,
        sender: {
          _id: row.senderId,
          name: row.senderName,
          email: row.senderEmail,
          profilePicture: row.senderProfilePicture
        },
        recipient: {
          _id: row.recipientId,
          name: row.recipientName,
          email: row.recipientEmail,
          profilePicture: row.recipientProfilePicture
        }
      };

      console.log('Populated message ready to send:', populatedMessage);

      // Send message to recipient if online - FORCE STRING ID FOR ROOM
      io.to(`user:${String(recipientId)}`).emit('new-message', populatedMessage);
      // Also send back to sender (confirmation) - FORCE STRING ID FOR ROOM
      io.to(`user:${String(senderId)}`).emit('new-message', populatedMessage);
      
      console.log(`Message emitted to rooms user:${recipientId} and user:${senderId}`);
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('message-error', { error: 'Failed to send message', details: error.message });
    }
  });

  // Handle marking messages as read
  socket.on('mark-messages-read', async ({ userId, senderId }) => {
    // ENFORCE JWT RECIPIENT AUTHENTICATION
    if (!socket.decodedUserId || String(userId) !== String(socket.decodedUserId)) {
      console.warn(`Blocked unauthorized mark-read request from ${socket.decodedUserId} for ${userId}`);
      return;
    }

    try {
      await query('UPDATE messages SET read = true WHERE recipient_id = $1 AND sender_id = $2 AND read = false', [userId, senderId]);

      // Notify sender that messages have been read
      io.to(`user:${senderId}`).emit('messages-marked-read', { by: userId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle group messages
  socket.on('send_group_message', async ({ groupId, content, type = 'text' }) => {
    try {
      const senderId = socket.userId || socket.decodedUserId;
      if (!senderId || !socket.decodedUserId || String(senderId) !== String(socket.decodedUserId)) {
        socket.emit('message-error', { error: 'Sender not authorized for group message' });
        return;
      }

      // Verify if only admins can message
      const groupRows = await query('SELECT only_admins_can_message FROM groups WHERE id = $1 LIMIT 1', [groupId]);
      if (groupRows.length && groupRows[0].only_admins_can_message === true) {
        const memberRows = await query('SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1', [groupId, senderId]);
        if (!memberRows.length || memberRows[0].role !== 'admin') {
          socket.emit('message-error', { error: 'Only admins can message in this group' });
          return;
        }
      }

      // Save message to DB
      const result = await query(
        'INSERT INTO group_messages (group_id, sender_id, content, type) VALUES ($1, $2, $3, $4) RETURNING id',
        [groupId, senderId, content, type]
      );
      const msgId = result[0]?.id;

      // Fetch populated message
      const rows = await query(
        `SELECT gm.id, gm.content, gm.type, gm.created_at AS createdAt,
                u.id AS senderId, u.name AS senderName, u.profile_picture AS senderAvatar
           FROM group_messages gm
           JOIN users u ON u.id = gm.sender_id
          WHERE gm.id = $1 LIMIT 1`,
        [msgId]
      );
      
      const msg = rows[0];
      const formatted = {
        id: msg.id,
        groupId,
        content: msg.content,
        type: msg.type,
        createdAt: msg.createdAt,
        sender: { id: msg.senderId, name: msg.senderName, avatar: msg.senderAvatar }
      };

      // Broadcast to group members
      const members = await query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId]);
      members.forEach(m => {
        io.to(`user:${m.user_id}`).emit('new_group_message', formatted);
      });

    } catch (error) {
      console.error('Error sending group message:', error);
    }
  });

  // Handle post sharing
  socket.on('share-post', async ({ senderId, recipientId, postId, message }) => {
    // ENFORCE JWT SENDER AUTHENTICATION
    if (!socket.decodedUserId || String(senderId) !== String(socket.decodedUserId)) {
      console.warn(`Blocked unauthorized share-post request from ${socket.decodedUserId} as ${senderId}`);
      return;
    }

    try {
      await query('INSERT INTO messages (sender_id, recipient_id, content, type, post_id, read) VALUES ($1, $2, $3, $4, $5, false)', [senderId, recipientId, message || '', 'post', postId || null]);
      // For simplicity, emit a minimal event; clients can fetch thread on demand
      io.to(`user:${recipientId}`).emit('new-message', { senderId, recipientId, postId, type: 'post', content: message || '' });
      io.to(`user:${senderId}`).emit('new-message', { senderId, recipientId, postId, type: 'post', content: message || '' });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  });
};

module.exports = setupMessageHandlers;
