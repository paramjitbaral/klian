import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/emails';

const getToken = () => {
  const token = localStorage.getItem('token');
  return token ? `Bearer ${token}` : '';
};

const axiosConfig = () => ({
  headers: {
    Authorization: getToken(),
  },
});

export const emailsAPI = {
  // Get inbox
  getInbox: async (token?: string, search?: string) => {
    const response = await axios.get(`${API_BASE_URL}/inbox`, {
      ...axiosConfig(),
      params: { token, search }
    });
    // Return standard object matching pagination structures
    return {
      emails: response.data.emails || [],
      nextPageToken: response.data.nextPageToken || null
    };
  },

  // Get sent
  getSent: async (token?: string, search?: string) => {
    const response = await axios.get(`${API_BASE_URL}/sent`, {
      ...axiosConfig(),
      params: { token, search }
    });
    return {
      emails: response.data.emails || [],
      nextPageToken: response.data.nextPageToken || null
    };
  },

  // Get trash
  getTrash: async (token?: string, search?: string) => {
    const response = await axios.get(`${API_BASE_URL}/trash`, {
      ...axiosConfig(),
      params: { token, search }
    });
    return {
      emails: response.data.emails || [],
      nextPageToken: response.data.nextPageToken || null
    };
  },

  // Send email
  sendEmail: async (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) => {
    const response = await axios.post(API_BASE_URL, data, axiosConfig());
    return response.data;
  },

  // Mark as read
  markAsRead: async (emailId: string) => {
    const response = await axios.put(`${API_BASE_URL}/read/${encodeURIComponent(emailId)}`, {}, axiosConfig());
    return response.data;
  },

  // Delete email (move to trash)
  deleteEmail: async (emailId: string) => {
    const response = await axios.delete(`${API_BASE_URL}/${encodeURIComponent(emailId)}`, axiosConfig());
    return response.data;
  },

  // Restore email from trash
  restoreEmail: async (emailId: string) => {
    const response = await axios.post(`${API_BASE_URL}/restore/${encodeURIComponent(emailId)}`, {}, axiosConfig());
    return response.data;
  },

  // Delete email permanently
  deletePermanently: async (emailId: string) => {
    const response = await axios.delete(`${API_BASE_URL}/permanent/${encodeURIComponent(emailId)}`, axiosConfig());
    return response.data;
  },

  // Empty trash folder
  emptyTrash: async () => {
    const response = await axios.post(`${API_BASE_URL}/empty-trash`, {}, axiosConfig());
    return response.data;
  },

  // Get Gmail/Outlook Status
  getGmailStatus: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status`, axiosConfig());
      return response.data;
    } catch (err) {
      console.error('Error fetching Gmail sync status from server:', err);
      const connected = localStorage.getItem('email_sync_connected') === 'true';
      const email = localStorage.getItem('email_sync_email') || 'student@klians.com';
      const provider = localStorage.getItem('email_sync_provider') || 'google';
      return {
        connected,
        email,
        provider
      };
    }
  },

  // Disconnect Gmail/Outlook Status
  disconnectGmail: async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/disconnect`, {}, axiosConfig());
      localStorage.removeItem('email_sync_connected');
      localStorage.removeItem('email_sync_email');
      localStorage.removeItem('email_sync_provider');
      return response.data;
    } catch (err) {
      console.error('Error disconnecting Gmail sync on server:', err);
      localStorage.removeItem('email_sync_connected');
      localStorage.removeItem('email_sync_email');
      localStorage.removeItem('email_sync_provider');
      return { success: true };
    }
  }
};
