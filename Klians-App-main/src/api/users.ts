import API from './index';

export const usersAPI = {
  // Get user by ID
  getUserById: (id: string) => {
    return API.get(`/users/${id}`);
  },
  
  // Get all users
  getUsers: () => {
    return API.get('/users');
  },
  
  // Search users
  searchUsers: (query: string) => {
    return API.get(`/users/search?q=${query}`);
  }
};

export default usersAPI;