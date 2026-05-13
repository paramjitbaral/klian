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
  getInbox: async () => {
    const response = await axios.get(`${API_BASE_URL}/inbox`, axiosConfig());
    return response.data.emails;
  },

  // Get sent
  getSent: async () => {
    const response = await axios.get(`${API_BASE_URL}/sent`, axiosConfig());
    return response.data.emails;
  },

  // Get trash
  getTrash: async () => {
    const response = await axios.get(`${API_BASE_URL}/trash`, axiosConfig());
    return response.data.emails;
  },

  // Send email
  sendEmail: async (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) => {
    const response = await axios.post(API_BASE_URL, data, axiosConfig());
    return response.data;
  },

  // Mark as read
  markAsRead: async (emailId: string) => {
    const response = await axios.put(`${API_BASE_URL}/read/${emailId}`, {}, axiosConfig());
    return response.data;
  },

  // Delete email (move to trash)
  deleteEmail: async (emailId: string) => {
    const response = await axios.delete(`${API_BASE_URL}/${emailId}`, axiosConfig());
    return response.data;
  },
};
