const { query } = require('../config/db');

const setupMessageHandlers = (io, socket, redis) => {
  console.log('Setting up message handlers for socket:', socket.id);
  
  // Handle private messages
  socket.on('private-message', async ({ senderId, recipientId, content, type = 'text', postId }) => {
    console.log('Received private message:', { senderId, recipientId, content, type, postId });
    
    try {
      // Validate sender exists
      const sender = await query('SELECT id, name, email, profile_picture AS profilePicture FROM users WHERE id = ? LIMIT 1', [senderId]);
      if (!sender.length) {
        console.error('Sender not found:', senderId);
        socket.emit('message-error', { error: 'Sender not found' });
        return;
      }

      // Validate recipient exists
      const recipient = await query('SELECT id, name, email, profile_picture AS profilePicture FROM users WHERE id = ? LIMIT 1', [recipientId]);
      if (!recipient.length) {
        console.error('Recipient not found:', recipientId);
        socket.emit('message-error', { error: 'Recipient not found' });
        return;
      }

      // Create and save message
      const result = await query(
        'INSERT INTO messages (sender_id, recipient_id, content, type, post_id, `read`) VALUES (?, ?, ?, ?, ?, 0)',
        [senderId, recipientId, content, type, postId || null]
      );
      const msgId = result.insertId;

      // Load populated
      const rows = await query(
        `SELECT m.id, m.content, m.type, m.post_id AS postId, m.read, m.created_at,
                s.id AS senderId, s.name AS senderName, s.email AS senderEmail, s.profile_picture AS senderProfilePicture,
                r.id AS recipientId, r.name AS recipientName, r.email AS recipientEmail, r.profile_picture AS recipientProfilePicture
           FROM messages m
           JOIN users s ON s.id = m.sender_id
           JOIN users r ON r.id = m.recipient_id
          WHERE m.id = ? LIMIT 1`,
        [msgId]
      );
      const row = rows[0];
      const populatedMessage = {
        _id: row.id,
        content: row.content,
        type: row.type,
        postId: row.postId,
        read: row.read === 1,
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
    try {
      await query('UPDATE messages SET `read` = 1 WHERE recipient_id = ? AND sender_id = ? AND `read` = 0', [userId, senderId]);

      // Notify sender that messages have been read
      io.to(`user:${senderId}`).emit('messages-marked-read', { by: userId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle post sharing
  socket.on('share-post', async ({ senderId, recipientId, postId, message }) => {
    try {
      await query('INSERT INTO messages (sender_id, recipient_id, content, type, post_id, `read`) VALUES (?, ?, ?, ?, ?, 0)', [senderId, recipientId, message || '', 'post', postId || null]);
      // For simplicity, emit a minimal event; clients can fetch thread on demand
      io.to(`user:${recipientId}`).emit('new-message', { senderId, recipientId, postId, type: 'post', content: message || '' });
      io.to(`user:${senderId}`).emit('new-message', { senderId, recipientId, postId, type: 'post', content: message || '' });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  });
};

module.exports = setupMessageHandlers;