const { query } = require('../config/db');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Helper to refresh Microsoft token
const refreshMicrosoftToken = async (connId, refreshToken) => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', process.env.MICROSOFT_CLIENT_ID);
    params.append('scope', 'offline_access user.read mail.read mail.readwrite mail.send');
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET);

    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token: newRefreshToken } = tokenRes.data;
    
    // Save new tokens
    await query(
      'UPDATE connected_emails SET access_token = $1, refresh_token = $2 WHERE id = $3',
      [access_token, newRefreshToken || refreshToken, connId]
    );

    return access_token;
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error.response?.data || error.message);
    throw error;
  }
};

// Helper to fetch and verify active oauth token for user (either Gmail or Outlook)
const getAccessTokenForUser = async (userId) => {
  const connections = await query('SELECT * FROM connected_emails WHERE user_id = $1 LIMIT 1', [userId]);
  if (!connections.length) {
    return null;
  }
  
  const conn = connections[0];
  
  if (conn.provider === 'google') {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:5000/api/emails/google/callback'
    );
    oauth2Client.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token
    });
    
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await query('UPDATE connected_emails SET access_token = $1 WHERE id = $2', [tokens.access_token, conn.id]);
      }
    });
    
    return { provider: 'google', client: oauth2Client };
  } else if (conn.provider === 'microsoft') {
    // Prevent multiple parallel refreshes by checking updated_at (only refresh if last updated > 30 mins ago)
    const lastUpdated = new Date(conn.updated_at || conn.created_at);
    const now = new Date();
    const minutesSinceUpdate = (now - lastUpdated) / (1000 * 60);

    if (conn.access_token && minutesSinceUpdate < 30) {
      return { provider: 'microsoft', token: conn.access_token };
    }

    try {
      const activeToken = await refreshMicrosoftToken(conn.id, conn.refresh_token);
      return { provider: 'microsoft', token: activeToken };
    } catch (err) {
      console.warn('Failed to refresh Microsoft token, falling back to stored access token:', err.message);
      return { provider: 'microsoft', token: conn.access_token };
    }
  }
  
  return null;
};

// Base64URL decoder
const decodeBase64 = (base64urlStr) => {
  if (!base64urlStr) return '';
  let base64 = base64urlStr.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
};

const decodeHtmlEntities = (str) => {
  if (!str) return '';
  return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
};

// Recursive Gmail message body extractor
function getMessageBody(part) {
  if (!part) return '';
  
  if (part.body && part.body.data) {
    return decodeBase64(part.body.data);
  }
  
  if (part.parts && part.parts.length) {
    const htmlPart = findPartByMimeType(part.parts, 'text/html');
    if (htmlPart) return getMessageBody(htmlPart);
    
    const plainPart = findPartByMimeType(part.parts, 'text/plain');
    if (plainPart) return getMessageBody(plainPart);
    
    for (const subPart of part.parts) {
      const body = getMessageBody(subPart);
      if (body) return body;
    }
  }
  
  return '';
}

function findAttachmentParts(part, list = []) {
  if (!part) return list;
  
  const headers = part.headers || [];
  const contentIdHeader = headers.find(h => h.name.toLowerCase() === 'content-id')?.value || '';
  const attachmentId = part.body?.attachmentId;
  const xAttachmentId = headers.find(h => h.name.toLowerCase() === 'x-attachment-id')?.value || '';
  
  if (attachmentId && (contentIdHeader || xAttachmentId)) {
    const cleanCid = (contentIdHeader || xAttachmentId).replace(/[<>]/g, '').trim();
    list.push({
      cid: cleanCid,
      attachmentId: attachmentId,
      mimeType: part.mimeType || 'image/png'
    });
  }
  
  if (part.parts && part.parts.length) {
    for (const subPart of part.parts) {
      findAttachmentParts(subPart, list);
    }
  }
  
  return list;
}

async function resolveGmailCidImages(gmail, msgId, payload, bodyHtml) {
  if (!bodyHtml || !bodyHtml.includes('cid:')) return bodyHtml;
  
  try {
    const attachments = findAttachmentParts(payload);
    if (!attachments.length) return bodyHtml;
    
    let resolvedHtml = bodyHtml;
    for (const att of attachments) {
      const cidRegex = new RegExp(`src=["']cid:${att.cid}["']`, 'gi');
      if (resolvedHtml.match(cidRegex)) {
        try {
          const attachmentDetail = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msgId,
            id: att.attachmentId
          });
          
          if (attachmentDetail.data && attachmentDetail.data.data) {
            const base64Data = attachmentDetail.data.data.replace(/-/g, '+').replace(/_/g, '/');
            resolvedHtml = resolvedHtml.replace(cidRegex, `src="data:${att.mimeType};base64,${base64Data}"`);
          }
        } catch (err) {
          console.warn(`Failed to fetch attachment ${att.attachmentId} for cid ${att.cid}:`, err.message);
        }
      }
    }
    return resolvedHtml;
  } catch (error) {
    console.error('Error resolving Gmail CID images:', error);
    return bodyHtml;
  }
}

function findPartByMimeType(parts, mimeType) {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

// Construct RFC 2822 email for Gmail
const makeRawEmail = (to, subject, body) => {
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const parts = [
    `To: ${toStr}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    '',
    body
  ];
  const email = parts.join('\n');
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Google Auth initiator
exports.googleAuth = (req, res) => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/google/callback`;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  
  const state = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET || 'fallback_secret_for_dev', { expiresIn: '10m' });
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent'
  });
  
  res.redirect(authorizationUrl);
};

// Google Callback
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('No authorization code provided.');
  }
  
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET || 'fallback_secret_for_dev');
    const userId = decoded.userId;
    
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const emailAddress = userInfo.data.email;
    
    await query('DELETE FROM connected_emails WHERE user_id = $1', [userId]);
    
    await query(
      'INSERT INTO connected_emails (user_id, email, access_token, refresh_token, provider) VALUES ($1, $2, $3, $4, $5)',
      [userId, emailAddress, tokens.access_token, tokens.refresh_token || '', 'google']
    );
    
    const frontendUrl = req.get('host').includes('localhost') ? 'http://localhost:5173' : 'https://klian.pages.dev';
    res.redirect(`${frontendUrl}/#/mailbox`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
};

// Microsoft Outlook Auth initiator
exports.outlookAuth = (req, res) => {
  const state = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET || 'fallback_secret_for_dev', { expiresIn: '10m' });
  const redirectUri = encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/outlook/callback`);
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${encodeURIComponent('offline_access user.read mail.read mail.readwrite mail.send')}&state=${state}`;
  res.redirect(authUrl);
};

// Microsoft Outlook Callback
exports.outlookCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('No authorization code provided.');
  }
  
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET || 'fallback_secret_for_dev');
    const userId = decoded.userId;
    
    const params = new URLSearchParams();
    params.append('client_id', process.env.MICROSOFT_CLIENT_ID);
    params.append('scope', 'offline_access user.read mail.read mail.readwrite mail.send');
    params.append('code', code);
    params.append('redirect_uri', process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/email/outlook/callback`);
    params.append('grant_type', 'authorization_code');
    params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
    
    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    const { access_token, refresh_token } = tokenRes.data;
    
    const userRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const emailAddress = userRes.data.mail || userRes.data.userPrincipalName;
    
    await query('DELETE FROM connected_emails WHERE user_id = $1', [userId]);
    
    await query(
      'INSERT INTO connected_emails (user_id, email, access_token, refresh_token, provider) VALUES ($1, $2, $3, $4, $5)',
      [userId, emailAddress, access_token, refresh_token || '', 'microsoft']
    );
    
    const frontendUrl = req.get('host').includes('localhost') ? 'http://localhost:5173' : 'https://klian.pages.dev';
    res.redirect(`${frontendUrl}/#/mailbox`);
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed: ' + (error.response?.data?.error_description || error.message));
  }
};

// Get unified Gmail/Outlook connection status
exports.getStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const connections = await query('SELECT email, provider FROM connected_emails WHERE user_id = $1 LIMIT 1', [userId]);
    if (connections.length) {
      res.json({
        connected: true,
        email: connections[0].email,
        provider: connections[0].provider
      });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error fetching connection status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Disconnect active Gmail/Outlook account
exports.disconnect = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    await query('DELETE FROM connected_emails WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch real Inbox emails
exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const authInfo = await getAccessTokenForUser(userId);
    const search = req.query.search;
    const token = req.query.token;
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      const q = search ? `label:INBOX "${search}"` : 'label:INBOX';
      
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: q,
        maxResults: 20,
        pageToken: token || undefined
      });
      
      const messages = listResponse.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id
            });
            const headers = detail.data.payload.headers;
            const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
            
            let senderName = 'Unknown';
            let senderEmail = '';
            const fromMatch = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
            if (fromMatch) {
              senderName = fromMatch[1].replace(/['"]/g, '').trim() || fromMatch[2];
              senderEmail = fromMatch[2].trim();
            } else {
              senderEmail = fromHeader.trim();
              senderName = fromHeader.split('@')[0] || fromHeader;
            }
            
            const rawBody = getMessageBody(detail.data.payload);
            const body = await resolveGmailCidImages(gmail, msg.id, detail.data.payload, rawBody);
            const preview = detail.data.snippet ? decodeHtmlEntities(detail.data.snippet) : body.substring(0, 100).replace(/<[^>]*>/g, '').trim() + '...';
            
            return {
              id: msg.id,
              sender: {
                name: senderName,
                email: senderEmail,
                initial: senderName.charAt(0).toUpperCase(),
                color: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
              },
              subject: subjectHeader,
              preview: preview,
              body: body,
              timestamp: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
              isRead: !detail.data.labelIds?.includes('UNREAD')
            };
          } catch (err) {
            console.error(`Error fetching Gmail message ${msg.id}:`, err.message);
            return null;
          }
        })
      );
      
      return res.json({ 
        emails: emailDetails.filter(e => e !== null),
        nextPageToken: listResponse.data.nextPageToken || null
      });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      let url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20`;
      if (search) {
        url += `&$search="${encodeURIComponent(search)}"`;
      }
      if (token) {
        url += `&$skiptoken=${encodeURIComponent(token)}`;
      }

      const response = await axios.get(
        url,
        { headers: { Authorization: `Bearer ${authInfo.token}` } }
      );
      
      const messages = response.data.value || [];
      const emails = messages.map(msg => {
        const senderName = msg.from?.emailAddress?.name || 'Unknown';
        const senderEmail = msg.from?.emailAddress?.address || '';
        
        return {
          id: msg.id,
          sender: {
            name: senderName,
            email: senderEmail,
            initial: senderName.charAt(0).toUpperCase(),
            color: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
          },
          subject: msg.subject || '(No Subject)',
          preview: msg.bodyPreview || '',
          body: msg.body?.content || '',
          timestamp: msg.receivedDateTime || new Date().toISOString(),
          isRead: !!msg.isRead
        };
      });
      
      const nextLink = response.data['@odata.nextLink'];
      let nextPageToken = null;
      if (nextLink) {
        try {
          const urlObj = new URL(nextLink);
          nextPageToken = urlObj.searchParams.get('$skiptoken');
        } catch (err) {
          console.warn('Failed to parse nextLink URL:', err.message);
        }
      }

      return res.json({ emails, nextPageToken });
    }
    
    // Fallback to internal database inbox
    const searchVal = search ? `%${search}%` : null;
    let sql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp, 
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar,
             er.is_read as isRead, er.type
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON e.sender_id = u.id
      WHERE er.recipient_id = $1 AND er.is_deleted = false
    `;
    const params = [userId];
    if (searchVal) {
      sql += ' AND (e.subject LIKE $2 OR e.body LIKE $3)';
      params.push(searchVal, searchVal);
    }
    sql += ' ORDER BY e.created_at DESC';
    const rows = await query(sql, params);
    
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
    console.error('Error fetching inbox:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error while fetching inbox' });
  }
};

// Fetch real Sent emails
exports.getSent = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const authInfo = await getAccessTokenForUser(userId);
    const search = req.query.search;
    const token = req.query.token;
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      const q = search ? `label:SENT "${search}"` : 'label:SENT';
      
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: q,
        maxResults: 20,
        pageToken: token || undefined
      });
      
      const messages = listResponse.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id
            });
            const headers = detail.data.payload.headers;
            const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
            
            let recipientName = 'Unknown';
            let recipientEmail = '';
            const toMatch = toHeader.match(/^(.*?)\s*<(.*?)>$/);
            if (toMatch) {
              recipientName = toMatch[1].replace(/['"]/g, '').trim() || toMatch[2];
              recipientEmail = toMatch[2].trim();
            } else {
              recipientEmail = toHeader.trim();
              recipientName = toHeader.split('@')[0] || toHeader;
            }
            
            const rawBody = getMessageBody(detail.data.payload);
            const body = await resolveGmailCidImages(gmail, msg.id, detail.data.payload, rawBody);
            const preview = detail.data.snippet ? decodeHtmlEntities(detail.data.snippet) : body.substring(0, 100).replace(/<[^>]*>/g, '').trim() + '...';
            
            return {
              id: msg.id,
              recipient: {
                name: recipientName,
                email: recipientEmail,
                initial: recipientName.charAt(0).toUpperCase(),
                color: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              },
              subject: subjectHeader,
              preview: preview,
              body: body,
              timestamp: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
              isRead: true
            };
          } catch (err) {
            console.error(`Error fetching Gmail message ${msg.id}:`, err.message);
            return null;
          }
        })
      );
      
      return res.json({ 
        emails: emailDetails.filter(e => e !== null),
        nextPageToken: listResponse.data.nextPageToken || null
      });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      let url = `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=20`;
      if (search) {
        url += `&$search="${encodeURIComponent(search)}"`;
      }
      if (token) {
        url += `&$skiptoken=${encodeURIComponent(token)}`;
      }

      const response = await axios.get(
        url,
        { headers: { Authorization: `Bearer ${authInfo.token}` } }
      );
      
      const messages = response.data.value || [];
      const emails = messages.map(msg => {
        const recipientName = msg.toRecipients?.[0]?.emailAddress?.name || 'Unknown';
        const recipientEmail = msg.toRecipients?.[0]?.emailAddress?.address || '';
        
        return {
          id: msg.id,
          recipient: {
            name: recipientName,
            email: recipientEmail,
            initial: recipientName.charAt(0).toUpperCase(),
            color: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
          },
          subject: msg.subject || '(No Subject)',
          preview: msg.bodyPreview || '',
          body: msg.body?.content || '',
          timestamp: msg.receivedDateTime || new Date().toISOString(),
          isRead: true
        };
      });
      
      const nextLink = response.data['@odata.nextLink'];
      let nextPageToken = null;
      if (nextLink) {
        try {
          const urlObj = new URL(nextLink);
          nextPageToken = urlObj.searchParams.get('$skiptoken');
        } catch (err) {
          console.warn('Failed to parse nextLink URL:', err.message);
        }
      }

      return res.json({ emails, nextPageToken });
    }
    
    // Fallback to internal database sent emails
    const searchVal = search ? `%${search}%` : null;
    let sql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp,
             string_agg(u.name, ',') as recipientNames,
             string_agg(u.email, ',') as recipientEmails
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON er.recipient_id = u.id
      WHERE e.sender_id = $1 AND e.sender_deleted = false
    `;
    const params = [userId];
    if (searchVal) {
      sql += ' AND (e.subject LIKE $2 OR e.body LIKE $3)';
      params.push(searchVal, searchVal);
    }
    sql += ` GROUP BY e.id ORDER BY e.created_at DESC`;
    const rows = await query(sql, params);

    const emails = rows.map(row => ({
      id: row.id,
      recipient: {
        name: row.recipientNames.split(',')[0],
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

// Fetch real Trash emails
exports.getTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const authInfo = await getAccessTokenForUser(userId);
    const search = req.query.search;
    const token = req.query.token;
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      const q = search ? `label:TRASH "${search}"` : 'label:TRASH';
      
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: q,
        maxResults: 20,
        pageToken: token || undefined
      });
      
      const messages = listResponse.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id
            });
            const headers = detail.data.payload.headers;
            const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
            
            let senderName = 'Unknown';
            let senderEmail = '';
            const fromMatch = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
            if (fromMatch) {
              senderName = fromMatch[1].replace(/['"]/g, '').trim() || fromMatch[2];
              senderEmail = fromMatch[2].trim();
            } else {
              senderEmail = fromHeader.trim();
              senderName = fromHeader.split('@')[0] || fromHeader;
            }
            
            const rawBody = getMessageBody(detail.data.payload);
            const body = await resolveGmailCidImages(gmail, msg.id, detail.data.payload, rawBody);
            const preview = detail.data.snippet ? decodeHtmlEntities(detail.data.snippet) : body.substring(0, 100).replace(/<[^>]*>/g, '').trim() + '...';
            
            return {
              id: msg.id,
              sender: {
                name: senderName,
                email: senderEmail,
                initial: senderName.charAt(0).toUpperCase(),
                color: 'bg-red-100 text-red-700'
              },
              subject: subjectHeader,
              preview: preview,
              body: body,
              timestamp: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
              isRead: true
            };
          } catch (err) {
            console.error(`Error fetching Gmail message ${msg.id}:`, err.message);
            return null;
          }
        })
      );
      
      return res.json({ 
        emails: emailDetails.filter(e => e !== null),
        nextPageToken: listResponse.data.nextPageToken || null
      });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      let url = `https://graph.microsoft.com/v1.0/me/mailFolders/deleteditems/messages?$top=20`;
      if (search) {
        url += `&$search="${encodeURIComponent(search)}"`;
      }
      if (token) {
        url += `&$skiptoken=${encodeURIComponent(token)}`;
      }

      const response = await axios.get(
        url,
        { headers: { Authorization: `Bearer ${authInfo.token}` } }
      );
      
      const messages = response.data.value || [];
      const emails = messages.map(msg => {
        const senderName = msg.from?.emailAddress?.name || 'Unknown';
        const senderEmail = msg.from?.emailAddress?.address || '';
        
        return {
          id: msg.id,
          sender: {
            name: senderName,
            email: senderEmail,
            initial: senderName.charAt(0).toUpperCase(),
            color: 'bg-red-100 text-red-700'
          },
          subject: msg.subject || '(No Subject)',
          preview: msg.bodyPreview || '',
          body: msg.body?.content || '',
          timestamp: msg.receivedDateTime || new Date().toISOString(),
          isRead: true
        };
      });
      
      const nextLink = response.data['@odata.nextLink'];
      let nextPageToken = null;
      if (nextLink) {
        try {
          const urlObj = new URL(nextLink);
          nextPageToken = urlObj.searchParams.get('$skiptoken');
        } catch (err) {
          console.warn('Failed to parse nextLink URL:', err.message);
        }
      }

      return res.json({ emails, nextPageToken });
    }
    
    // Fallback to internal database trash
    const searchVal = search ? `%${search}%` : null;
    let deletedReceivedSql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp, 
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar
      FROM emails e
      JOIN email_recipients er ON e.id = er.email_id
      JOIN users u ON e.sender_id = u.id
      WHERE er.recipient_id = $1 AND er.is_deleted = true
    `;
    const receivedParams = [userId];
    if (searchVal) {
      deletedReceivedSql += ' AND (e.subject LIKE $2 OR e.body LIKE $3)';
      receivedParams.push(searchVal, searchVal);
    }
    const deletedReceived = await query(deletedReceivedSql, receivedParams);
 
    let deletedSentSql = `
      SELECT e.id, e.subject, e.body, e.created_at as timestamp,
             u.name as senderName, u.email as senderEmail, u.profile_picture as senderAvatar
      FROM emails e
      JOIN users u ON e.sender_id = u.id
      WHERE e.sender_id = $1 AND e.sender_deleted = true
    `;
    const sentParams = [userId];
    if (searchVal) {
      deletedSentSql += ' AND (e.subject LIKE $2 OR e.body LIKE $3)';
      sentParams.push(searchVal, searchVal);
    }
    const deletedSent = await query(deletedSentSql, sentParams);

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

// Send real Email via Gmail or Outlook
exports.sendEmail = async (req, res) => {
  try {
    const senderId = req.user.id || req.user._id;
    const { to, cc, bcc, subject, body, targetAudience } = req.body;

    const authInfo = await getAccessTokenForUser(senderId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      const raw = makeRawEmail(to, subject, body);
      
      const sendResult = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw
        }
      });
      
      return res.status(201).json({ message: 'Email sent successfully via Gmail', emailId: sendResult.data.id });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      const toRecipients = (Array.isArray(to) ? to : [to]).map(email => ({
        emailAddress: { address: email.trim() }
      }));
      
      const requestPayload = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: body
          },
          toRecipients: toRecipients
        },
        saveToSentItems: 'true'
      };
      
      await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        requestPayload,
        { headers: { Authorization: `Bearer ${authInfo.token}`, 'Content-Type': 'application/json' } }
      );
      
      return res.status(201).json({ message: 'Email sent successfully via Microsoft Outlook' });
    }
    
    // Fallback to database email sending
    if ((!to || !to.length) && !targetAudience && !subject && !body) {
      return res.status(400).json({ message: 'Recipient, subject and body are required' });
    }

    const result = await query(
      'INSERT INTO emails (sender_id, subject, body) VALUES ($1, $2, $3) RETURNING id',
      [senderId, subject, body]
    );
    const emailId = result[0]?.id;

    const addRecipients = async (emails, type) => {
      if (!emails || !emails.length) return;
      for (const email of emails) {
        const users = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
        if (users.length) {
          await query(
            'INSERT INTO email_recipients (email_id, recipient_id, type) VALUES ($1, $2, $3)',
            [emailId, users[0].id, type]
          );
        }
      }
    };

    if (targetAudience) {
      let targetSql = 'SELECT id FROM users WHERE id != $1';
      const params = [senderId];

      if (targetAudience === 'Student') {
        targetSql += " AND role IN ('student', 'Student')";
      } else if (targetAudience === 'Teacher') {
        targetSql += " AND role IN ('teacher', 'Teacher', 'faculty', 'Faculty')";
      }

      const targetUsers = await query(targetSql, params);
      for (const tUser of targetUsers) {
        await query(
          'INSERT INTO email_recipients (email_id, recipient_id, type) VALUES ($1, $2, $3)',
          [emailId, tUser.id, 'to']
        );
      }
    }

    await addRecipients(to, 'to');
    await addRecipients(cc, 'cc');
    await addRecipients(bcc, 'bcc');

    res.status(201).json({ message: 'Email sent successfully', emailId });
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error while sending email' });
  }
};

// Mark Gmail or Outlook email as Read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    const authInfo = await getAccessTokenForUser(userId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: [emailId],
          removeLabelIds: ['UNREAD']
        }
      });
      return res.json({ message: 'Gmail email marked as read' });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      await axios.patch(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(emailId)}`,
        { isRead: true },
        { headers: { Authorization: `Bearer ${authInfo.token}`, 'Content-Type': 'application/json' } }
      );
      return res.json({ message: 'Outlook email marked as read' });
    }

    await query(
      'UPDATE email_recipients SET is_read = true WHERE email_id = $1 AND recipient_id = $2',
      [emailId, userId]
    );

    res.json({ message: 'Email marked as read' });
  } catch (error) {
    console.error('Error marking as read:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Move Gmail or Outlook email to Trash
exports.moveToTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    const authInfo = await getAccessTokenForUser(userId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      await gmail.users.messages.trash({
        userId: 'me',
        id: emailId
      });
      return res.json({ message: 'Gmail email moved to trash' });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      await axios.post(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(emailId)}/move`,
        { destinationId: 'deleteditems' },
        { headers: { Authorization: `Bearer ${authInfo.token}`, 'Content-Type': 'application/json' } }
      );
      return res.json({ message: 'Outlook email moved to trash' });
    }

    await query(
      'UPDATE email_recipients SET is_deleted = true WHERE email_id = $1 AND recipient_id = $2',
      [emailId, userId]
    );

    await query(
      'UPDATE emails SET sender_deleted = true WHERE id = $1 AND sender_id = $2',
      [emailId, userId]
    );

    res.json({ message: 'Email moved to trash' });
  } catch (error) {
    console.error('Error moving to trash:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Restore Gmail or Outlook email from Trash
exports.restoreFromTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    const authInfo = await getAccessTokenForUser(userId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      await gmail.users.messages.untrash({
        userId: 'me',
        id: emailId
      });
      return res.json({ message: 'Gmail email restored from trash' });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      await axios.post(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(emailId)}/move`,
        { destinationId: 'inbox' },
        { headers: { Authorization: `Bearer ${authInfo.token}`, 'Content-Type': 'application/json' } }
      );
      return res.json({ message: 'Outlook email restored from trash' });
    }

    await query(
      'UPDATE email_recipients SET is_deleted = false WHERE email_id = $1 AND recipient_id = $2',
      [emailId, userId]
    );

    await query(
      'UPDATE emails SET sender_deleted = false WHERE id = $1 AND sender_id = $2',
      [emailId, userId]
    );

    res.json({ message: 'Email restored from trash' });
  } catch (error) {
    console.error('Error restoring from trash:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error while restoring email' });
  }
};

// Delete Gmail or Outlook email Permanently
exports.deletePermanently = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { emailId } = req.params;

    const authInfo = await getAccessTokenForUser(userId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      await gmail.users.messages.delete({
        userId: 'me',
        id: emailId
      });
      return res.json({ message: 'Gmail email deleted permanently' });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(emailId)}`,
        { headers: { Authorization: `Bearer ${authInfo.token}` } }
      );
      return res.json({ message: 'Outlook email deleted permanently' });
    }

    await query(
      'DELETE FROM email_recipients WHERE email_id = $1 AND recipient_id = $2',
      [emailId, userId]
    );

    res.json({ message: 'Email deleted permanently' });
  } catch (error) {
    console.error('Error deleting permanently:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error while deleting email permanently' });
  }
};

// Empty all emails from Gmail or Outlook Trash folder
exports.emptyTrash = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const authInfo = await getAccessTokenForUser(userId);
    
    if (authInfo && authInfo.provider === 'google') {
      const gmail = google.gmail({ version: 'v1', auth: authInfo.client });
      
      // Fetch all messages in Trash
      let allTrashIds = [];
      let pageToken = undefined;
      
      do {
        const listTrash = await gmail.users.messages.list({
          userId: 'me',
          labelIds: ['TRASH'],
          maxResults: 100,
          pageToken: pageToken
        });
        
        const messages = listTrash.data.messages || [];
        allTrashIds.push(...messages.map(m => m.id));
        pageToken = listTrash.data.nextPageToken;
      } while (pageToken);
      
      console.log(`[emptyTrash] Found ${allTrashIds.length} messages in Gmail Trash`);
      
      if (allTrashIds.length > 0) {
        // Try permanent delete first (requires mail.google.com scope)
        let deleteSucceeded = false;
        try {
          // Test with first message
          await gmail.users.messages.delete({
            userId: 'me',
            id: allTrashIds[0]
          });
          deleteSucceeded = true;
        } catch (testErr) {
          console.warn('[emptyTrash] Permanent delete not available (scope limitation):', testErr.message);
        }
        
        if (deleteSucceeded) {
          // Permanent delete works - delete remaining messages
          const remaining = allTrashIds.slice(1);
          if (remaining.length > 0) {
            await Promise.all(
              remaining.map(id =>
                gmail.users.messages.delete({
                  userId: 'me',
                  id: id
                }).catch(err => console.warn(`Failed to delete message ${id}:`, err.message))
              )
            );
          }
          return res.json({ message: 'Gmail trash emptied - all emails permanently deleted', count: allTrashIds.length });
        } else {
          // Permanent delete not available - emails remain in Gmail Trash
          // Gmail automatically purges trash after 30 days
          return res.json({ 
            message: 'Trash cleared from view. Emails remain in Gmail Trash and will be auto-deleted by Gmail after 30 days.',
            count: allTrashIds.length 
          });
        }
      }
      
      return res.json({ message: 'Gmail trash is already empty', count: 0 });
    } else if (authInfo && authInfo.provider === 'microsoft') {
      // Fetch up to 50 messages in Deleted Items
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/mailFolders/deleteditems/messages?$top=50`,
        { headers: { Authorization: `Bearer ${authInfo.token}` } }
      );
      
      const messages = response.data.value || [];
      for (const msg of messages) {
        await axios.delete(
          `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(msg.id)}`,
          { headers: { Authorization: `Bearer ${authInfo.token}` } }
        ).catch(err => console.warn(`Failed to delete message ${msg.id} in Outlook trash:`, err.message));
      }
      
      return res.json({ message: 'Outlook trash emptied successfully' });
    }

    await query(
      'DELETE FROM email_recipients WHERE recipient_id = $1 AND is_deleted = true',
      [userId]
    );

    res.json({ message: 'Trash emptied successfully' });
  } catch (error) {
    console.error('Error emptying trash:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error while emptying trash' });
  }
};

