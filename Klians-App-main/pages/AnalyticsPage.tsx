import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ICONS } from '../constants';
import { Card } from '../components/ui/Card';
import { analyticsAPI, AnalyticsData } from '../src/api/analytics';
import { useSocket } from '../contexts/SocketContext';

const AnalyticsCard: React.FC<{title: string; value: string | number; change?: string; isPositive?: boolean; children?: React.ReactNode}> = ({title, value, change, isPositive, children}) => (
  <Card className="p-5 sm:p-6">
    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{title}</h3>
    <p className="text-4xl font-bold mt-3 text-slate-900 dark:text-white">{value}</p>
    {change && (
      <div className={`flex items-center gap-1 mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        <span>{change}</span>
      </div>
    )}
    {children}
  </Card>
)

export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getAnalytics();
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Auto-refresh analytics every 60 seconds
    const intervalId = setInterval(fetchAnalytics, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Listen for real-time updates via socket
  useEffect(() => {
    if (!socket) return;

    const handleDataChange = () => {
      fetchAnalytics();
    };

    socket.on('new-post', handleDataChange);
    socket.on('new-message', handleDataChange);
    socket.on('new-event', handleDataChange);
    socket.on('announcement-created', handleDataChange);
    socket.on('user-registered', handleDataChange);

    return () => {
      socket.off('new-post', handleDataChange);
      socket.off('new-message', handleDataChange);
      socket.off('new-event', handleDataChange);
      socket.off('announcement-created', handleDataChange);
      socket.off('user-registered', handleDataChange);
    };
  }, [socket]);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
    } else {
        navigate('/home', { replace: true });
    }
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-pulse">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64" />
          </div>

          {/* Metric cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 space-y-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
              </div>
            ))}
          </div>

          {/* Main Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 space-y-4">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-[300px] bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full" />
              </div>
            ))}
          </div>

          {/* Secondary Charts card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 space-y-4">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
            <div className="h-[300px] bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full" />
          </div>

          {/* Lower metric cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { keyMetrics, userEngagement, postActivity, messagingActivity } = analytics;
  const hasPostData = postActivity && postActivity.some(item => item?.value > 0);
  const hasMessagingData = messagingActivity && messagingActivity.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center md:hidden">
        <button 
          onClick={handleBack} 
          className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">Analytics</h1>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={handleBack} 
            className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
        </div>
        
        {/* Mobile Spacer */}
        <div className="h-12 md:hidden"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard 
          title="Total Users" 
          value={keyMetrics.totalUsers.toLocaleString()}
          change={`+${keyMetrics.userGrowth} this month`}
          isPositive={true}
        />
        <AnalyticsCard 
          title="Active Users" 
          value={keyMetrics.activeUsers.toLocaleString()}
        />
        <AnalyticsCard 
          title="Posts Today" 
          value={keyMetrics.postsToday.toLocaleString()}
        />
        <AnalyticsCard 
          title="Messages Sent" 
          value={keyMetrics.messagesSent.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">User Engagement (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userEngagement}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#475569', borderRadius: '0.5rem' }}
              />
              <Legend />
              <Line type="monotone" dataKey="value" name="Active Users" stroke="#DC2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="flex flex-col min-h-[340px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Post Activity by Role</h2>
          {hasPostData ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={postActivity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {postActivity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#475569', borderRadius: '0.5rem' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
              No post activity data yet.
            </div>
          )}
        </Card>
      </div>
      
       <Card className="flex flex-col min-h-[340px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Messaging Activity (Last 7 Days)</h2>
          {hasMessagingData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={messagingActivity}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#475569', borderRadius: '0.5rem' }} />
                <Legend />
                <Bar dataKey="DMs" fill="#DC2626" />
                <Bar dataKey="Groups" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
              No messaging data yet.
            </div>
          )}
        </Card>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Posts</h3>
            <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{keyMetrics.totalPosts.toLocaleString()}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Groups</h3>
            <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{keyMetrics.totalGroups.toLocaleString()}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Events</h3>
            <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{keyMetrics.totalEvents.toLocaleString()}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Announcements</h3>
            <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{keyMetrics.totalAnnouncements.toLocaleString()}</p>
          </Card>
        </div>
      </div>
    </div>
  );
};
