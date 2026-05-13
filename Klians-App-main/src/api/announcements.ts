import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/announcements';

const getToken = () => {
  const token = localStorage.getItem('token');
  return token ? `Bearer ${token}` : '';
};

const axiosConfig = () => ({
  headers: {
    Authorization: getToken(),
  },
});

export const announcementsAPI = {
  // Get all announcements
  getAnnouncements: async () => {
    try {
      const response = await axios.get(API_BASE_URL, axiosConfig());
      return response.data.announcements;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }
  },

  // Get unread count
  getUnreadCount: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/unread-count`, axiosConfig());
      return response.data.unreadCount;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  },

  // Create announcement
  createAnnouncement: async (data) => {
    try {
      const response = await axios.post(API_BASE_URL, data, axiosConfig());
      return response.data.announcement;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  },

  // Mark as read
  markAsRead: async (announcementId) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/read/${announcementId}`,
        {},
        axiosConfig()
      );
      return response.data.announcement;
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      throw error;
    }
  },

  // Update announcement
  updateAnnouncement: async (announcementId, data) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/${announcementId}`,
        data,
        axiosConfig()
      );
      return response.data.announcement;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  },

  // Delete announcement
  deleteAnnouncement: async (announcementId) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/${announcementId}`,
        axiosConfig()
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  },
};
