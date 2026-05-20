const { query } = require('../config/db');

exports.getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const last6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Key Metrics
    const userCountsResult = await query('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END), 0) AS active FROM users', [last30Days]);
    const userCounts = userCountsResult[0] || { total: 0, active: 0 };
    
    const postsTodayResult = await query('SELECT COUNT(*) AS cnt FROM posts WHERE created_at >= $1', [today]);
    const postsToday = postsTodayResult[0] || { cnt: 0 };
    
    const messagesTodayResult = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= $1', [today]);
    const messagesToday = messagesTodayResult[0] || { cnt: 0 };

    // User Engagement (Last 6 Months)
    const userEngagement = await query(`
      SELECT to_char(created_at, 'Mon') AS name, COUNT(*) AS value
      FROM users
      WHERE created_at >= $1
      GROUP BY EXTRACT(MONTH FROM created_at), to_char(created_at, 'Mon')
      ORDER BY EXTRACT(MONTH FROM created_at) ASC
    `, [last6Months]);

    // Post Activity by Role
    const postActivityByRole = await query(`
      SELECT u.role AS name, COUNT(*) AS value
      FROM posts p
      JOIN users u ON u.id = p.user_id
      GROUP BY u.role
    `);

    const postActivity = (postActivityByRole || []).map(item => ({
      name: item.name.toLowerCase() === 'student' ? 'Students' : 'Teachers',
      value: item.value,
      fill: item.name.toLowerCase() === 'student' ? '#3B82F6' : '#10B981'
    }));

    // Messaging Activity (Last 7 days)
    const messagingActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 19).replace('T', ' ');
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString().slice(0, 19).replace('T', ' ');

      const dmsResult = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= $1 AND created_at < $2 AND post_id IS NULL', [start, end]);
      const groupMsgsResult = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= $1 AND created_at < $2 AND post_id IS NOT NULL', [start, end]);
      
      const dms = dmsResult[0] || { cnt: 0 };
      const groupMsgs = groupMsgsResult[0] || { cnt: 0 };

      messagingActivity.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        DMs: dms.cnt || 0,
        Groups: groupMsgs.cnt || 0
      });
    }

    // Additional Stats
    const totalPostsResult = await query('SELECT COUNT(*) AS cnt FROM posts');
    const totalGroupsResult = await query('SELECT COUNT(*) AS cnt FROM groups');
    const totalEventsResult = await query('SELECT COUNT(*) AS cnt FROM events');
    const totalAnnouncementsResult = await query('SELECT COUNT(*) AS cnt FROM announcements');
    
    const totalPosts = totalPostsResult[0] || { cnt: 0 };
    const totalGroups = totalGroupsResult[0] || { cnt: 0 };
    const totalEvents = totalEventsResult[0] || { cnt: 0 };
    const totalAnnouncements = totalAnnouncementsResult[0] || { cnt: 0 };

    // Most Active Users (Top 5)
    const mostActiveUsers = await query(`
      SELECT u.name, COUNT(p.id) AS postCount
      FROM users u
      JOIN posts p ON u.id = p.user_id
      GROUP BY u.id, u.name
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
    console.error('Error fetching analytics [DEBUG STACK]:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching analytics', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

// Get real-time stats (for live updates)
exports.getRealTimeStats = async (req, res) => {
  try {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const recentPosts = await query('SELECT COUNT(*) AS cnt FROM posts WHERE created_at >= $1', [last5Minutes]);
    const recentMessages = await query('SELECT COUNT(*) AS cnt FROM messages WHERE created_at >= $1', [last5Minutes]);
    const onlineUsers = await query('SELECT COUNT(*) AS cnt FROM users WHERE updated_at >= $1', [last5Minutes]);

    res.json({
      recentPosts: recentPosts[0].cnt,
      recentMessages: recentMessages[0].cnt,
      onlineUsers: onlineUsers[0].cnt,
      timestamp: now
    });
  } catch (error) {
    console.error('Error fetching real-time stats:', error);
    res.status(500).json({ message: 'Error fetching real-time stats', error: error.message });
  }
};
