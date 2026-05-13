const { query } = require('../config/db');

// Get dashboard analytics
exports.getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const last6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Key Metrics
    const [userCounts] = await query('SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS active FROM users', [last30Days]);
    const [postsToday] = await query('SELECT COUNT(*) AS cnt FROM posts WHERE created_at >= ?', [today]);
    const [messagesToday] = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= ?', [today]);

    // User Engagement (Last 6 Months)
    const userEngagement = await query(`
      SELECT DATE_FORMAT(created_at, '%b') AS name, COUNT(*) AS value
      FROM users
      WHERE created_at >= ?
      GROUP BY name, MONTH(created_at)
      ORDER BY MONTH(created_at) ASC
    `, [last6Months]);

    // Post Activity by Role
    const postActivityByRole = await query(`
      SELECT u.role AS name, COUNT(*) AS value
      FROM posts p
      JOIN users u ON u.id = p.user_id
      GROUP BY u.role
    `);

    const postActivity = postActivityByRole.map(item => ({
      name: item.name === 'student' ? 'Students' : 'Teachers',
      value: item.value,
      fill: item.name === 'student' ? '#3B82F6' : '#10B981'
    }));

    // Messaging Activity (Last 7 days)
    const messagingActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 19).replace('T', ' ');
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString().slice(0, 19).replace('T', ' ');

      const [dms] = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= ? AND created_at < ? AND post_id IS NULL', [start, end]);
      const [groupMsgs] = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= ? AND created_at < ? AND post_id IS NOT NULL', [start, end]);

      messagingActivity.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        DMs: dms.cnt,
        Groups: groupMsgs.cnt
      });
    }

    // Additional Stats
    const [totalPosts] = await query('SELECT COUNT(*) AS cnt FROM posts');
    const [totalGroups] = await query('SELECT COUNT(*) AS cnt FROM `groups`');
    const [totalEvents] = await query('SELECT COUNT(*) AS cnt FROM events');
    const [totalAnnouncements] = await query('SELECT COUNT(*) AS cnt FROM announcements');

    // Most Active Users (Top 5)
    const mostActiveUsers = await query(`
      SELECT u.name, COUNT(p.id) AS postCount
      FROM users u
      JOIN posts p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY postCount DESC
      LIMIT 5
    `);

    res.json({
      keyMetrics: {
        totalUsers: userCounts.total,
        activeUsers: userCounts.active,
        postsToday: postsToday.cnt,
        messagesSent: messagesToday.cnt,
        totalPosts: totalPosts.cnt,
        totalGroups: totalGroups.cnt,
        totalEvents: totalEvents.cnt,
        totalAnnouncements: totalAnnouncements.cnt,
        userGrowth: userCounts.active // Using users joined in last 30 days as growth
      },
      userEngagement,
      postActivity,
      messagingActivity,
      mostActiveUsers
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Get real-time stats (for live updates)
exports.getRealTimeStats = async (req, res) => {
  try {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const [recentPosts] = await query('SELECT COUNT(*) AS cnt FROM posts WHERE created_at >= ?', [last5Minutes]);
    const [recentMessages] = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= ?', [last5Minutes]);
    const [onlineUsers] = await query('SELECT COUNT(*) AS cnt FROM users WHERE updated_at >= ?', [last5Minutes]);

    res.json({
      recentPosts: recentPosts.cnt,
      recentMessages: recentMessages.cnt,
      onlineUsers: onlineUsers.cnt,
      timestamp: now
    });
  } catch (error) {
    console.error('Error fetching real-time stats:', error);
    res.status(500).json({ message: 'Error fetching real-time stats', error: error.message });
  }
};
