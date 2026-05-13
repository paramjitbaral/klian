import API from './index';

// Auth API services
export const authAPI = {
  // Register a new user
  register: (userData: any) => {
    return API.post('/auth/register', userData);
  },
  
  // Login user
  login: (email: string, password: string) => {
    return API.post('/auth/login', { email, password });
  },

  // Verify OTP
  verify: (email: string, otp: string) => {
    return API.post('/auth/verify', { email, otp });
  },

  // Resend OTP
  resendOTP: (email: string) => {
    return API.post('/auth/resend-otp', { email });
  },
  
  // Get current user profile
  getProfile: () => {
    return API.get('/auth/profile');
  },
  
  // Update user profile
  updateProfile: (userData: any) => {
    return API.put('/auth/profile', userData);
  },
  
  // Change password
  changePassword: (passwordData: any) => {
    return API.put('/auth/change-password', passwordData);
  },

  // Request OTP for password change
  requestPasswordOTP: (currentPassword: string) => {
    return API.post('/auth/request-password-otp', { currentPassword });
  },

  // Verify and change password
  verifyPasswordChange: (data: any) => {
    return API.put('/auth/verify-password-change', data);
  }
};

export default authAPI;