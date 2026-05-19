import axios from 'axios';
import { getBackendUrl } from './config';

const API_URL = `${getBackendUrl()}/api/analytics`;

export interface AnalyticsData {
  keyMetrics: {
    totalUsers: number;
    activeUsers: number;
    postsToday: number;
    messagesSent: number;
    totalPosts: number;
    totalGroups: number;
    totalEvents: number;
    totalAnnouncements: number;
    userGrowth: number;
  };
  userEngagement: Array<{ name: string; value: number }>;
  postActivity: Array<{ name: string; value: number; fill: string }>;
  messagingActivity: Array<{ name: string; DMs: number; Groups: number }>;
  mostActiveUsers: Array<{ name: string; postCount: number }>;
}

export interface RealTimeStats {
  recentPosts: number;
  recentMessages: number;
  onlineUsers: number;
  timestamp: Date;
}

export const analyticsAPI = {
  getAnalytics: async (): Promise<{ data: AnalyticsData }> => {
    const token = localStorage.getItem('token');
    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  },

  getRealTimeStats: async (): Promise<{ data: RealTimeStats }> => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/realtime`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response;
  }
};
