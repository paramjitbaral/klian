const { query } = require('../config/db');

// Get user inbox
exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const sql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp, 
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar,
             er.is_read as isRead, er.type
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON e.sender_id = u.id
      WHERE er.recipient_id = ? AND er.is_deleted = 0
      ORDER BY e.created_at DESC
    `;
    const rows = await query(sql, [userId]);
    
    const emails = rows.map(row => ({
      id: row.id,
      sender: {
        name: row.senderName,
        email: row.senderEmail,
        initial: row.senderName.charAt(0).toUpperCase(),
        color: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
      },
      subject: row.subject,
      preview: row.body.substring(0, 100).replace(/<[^>]*>/g, '') + '...',
      body: row.body,
      timestamp: row.timestamp,
      isRead: !!row.isRead,
      type: row.type
    }));

    res.json({ emails });
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ message: 'Server error while fetching inbox' });
  }
};

// Get sent emails
exports.getSent = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const sql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp,
             GROUP_CONCAT(u.name) as recipientNames,
             GROUP_CONCAT(u.email) as recipientEmails
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON er.recipient_id = u.id
      WHERE e.sender_id = ? AND e.sender_deleted = 0
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;
    const rows = await query(sql, [userId]);

    const emails = rows.map(row => ({
      id: row.id,
      recipient: {
        name: row.recipientNames.split(',')[0], // Just show first for preview
        email: row.recipientEmails.split(',')[0],
        initial: row.recipientNames.charAt(0).toUpperCase(),
        color: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
      },
      subject: row.subject,
      preview: row.body.substring(0, 100).replace(/<[^>]*>/g, '') + '...',
      body: row.body,
      timestamp: row.timestamp,
      isRead: true
    }));

    res.json({ emails });
  } catch (error) {
    console.error('Error fetching sent mail:', error);
    res.status(500).json({ message: 'Server error while fetching sent mail' });
  }
};

// Send email
exports.sendEmail = async (req, res) => {
  try {
    const senderId = req.user.id || req.user._id;
    const { to, cc, bcc, subject, body, targetAudience } = req.body;

    if ((!to || !to.length) && !targetAudience && !subject && !body) {
      return res.status(400).json({ message: 'Recipient, subject and body are required' });
    }

    // Insert main email record
    const result = await query(
      'INSERT INTO emails (sender_id, subject, body) VALUES (?, ?, ?)',
      [senderId, subject, body]
    );
    const emailId = result.insertId;

    // Helper to add recipients
    const addRecipients = async (emails, type) => {
      if (!emails || !emails.length) return;
      for (const email of emails) {
        // Find user by email
        const users = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length) {
          await query(
            'INSERT INTO email_recipients (email_id, recipient_id, type) VALUES (?, ?, ?)',
            [emailId, users[0].id, type]
          );
        }
      }
    };

    // If targetAudience is specified (for broadcasts)
    if (targetAudience) {
      let targetSql = 'SELECT id FROM users WHERE id != ?';
      const params = [senderId];

      if (targetAudience === 'Student') {
        targetSql += " AND role IN ('student', 'Student')";
      } else if (targetAudience === 'Teacher') {
        targetSql += " AND role IN ('teacher', 'Teacher', 'faculty', 'Faculty')";
      }

      const targetUsers = await query(targetSql, params);
      for (const tUser of targetUsers) {
        await query(
          'INSERT INTO email_recipients (email_id, recipient_id, type) VALUES (?, ?, ?)',
          [emailId, tUser.id, 'to']
        );
      }
    }

    await addRecipients(to, 'to');
    await addRecipients(cc, 'cc');
    await addRecipients(bcc, 'bcc');

    res.status(201).json({ message: 'Email sent successfully', emailId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Server error while sending email' });
  }
};

// Mark as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    await query(
      'UPDATE email_recipients SET is_read = 1 WHERE email_id = ? AND recipient_id = ?',
      [emailId, userId]
    );

    res.json({ message: 'Email marked as read' });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Move to trash
exports.moveToTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    // Check if user is recipient
    await query(
      'UPDATE email_recipients SET is_deleted = 1 WHERE email_id = ? AND recipient_id = ?',
      [emailId, userId]
    );

    // Check if user is sender
    await query(
      'UPDATE emails SET sender_deleted = 1 WHERE id = ? AND sender_id = ?',
      [emailId, userId]
    );

    res.json({ message: 'Email moved to trash' });
  } catch (error) {
    console.error('Error moving to trash:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get trash
exports.getTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    // Emails received but deleted
    const deletedReceived = await query(`
      SELECT e.id, e.subject, e.body, e.created_at as timestamp, 
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON e.sender_id = u.id
      WHERE er.recipient_id = ? AND er.is_deleted = 1
    `, [userId]);

    // Emails sent but deleted
    const deletedSent = await query(`
      SELECT e.id, e.subject, e.body, e.created_at as timestamp,
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar
      FROM emails e
      JOIN users u ON e.sender_id = u.id
      WHERE e.sender_id = ? AND e.sender_deleted = 1
    `, [userId]);

    const allTrash = [...deletedReceived, ...deletedSent].map(row => ({
      id: row.id,
      sender: {
        name: row.senderName,
        email: row.senderEmail,
        initial: row.senderName.charAt(0).toUpperCase(),
        color: 'bg-red-100 text-red-700'
      },
      subject: row.subject,
      preview: row.body.substring(0, 100) + '...',
      body: row.body,
      timestamp: row.timestamp,
      isRead: true
    }));

    res.json({ emails: allTrash });
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
