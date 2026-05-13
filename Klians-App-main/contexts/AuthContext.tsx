import React, { createContext, useState, useMemo, useEffect } from 'react';
import { User, Role } from '../types';
import authAPI from '../src/api/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  verify: (email: string, otp: string) => Promise<void>;
  resendOTP: (email: string) => Promise<void>;
  logout: () => void;
  register: (userData: { name: string, email: string, password: string, role?: Role }) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (passwordData: { currentPassword: string, newPassword: string }) => Promise<void>;
  requestPasswordOTP: (currentPassword: string) => Promise<void>;
  verifyPasswordChange: (data: { currentPassword: string, newPassword: string, otp: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to normalize backend user data to frontend User type
const normalizeUser = (data: any): User => {
  if (!data) {
    throw new Error('User data is required for normalization');
  }
  
  // Map backend roles to frontend roles
  let role = data.role as Role;
  if (data.role === 'faculty') {
    role = Role.TEACHER;
  } else if (data.role === 'student') {
    role = Role.STUDENT;
  }
  
  return {
    id: data._id || data.id,
    name: data.name,
    username: data.email?.split('@')[0] || '', // Use email prefix as username
    email: data.email,
    avatar: data.profilePicture || data.avatar || '', // Map profilePicture to avatar
    coverPhoto: data.coverPhoto || '',
    bio: data.bio || '',
    linkedin: data.linkedin || '',
    github: data.github || '',
    portfolio: data.portfolio || '',
    role: role,
    createdAt: data.createdAt || new Date().toISOString(),
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAuthenticated = !!user && !!localStorage.getItem('token');

  useEffect(() => {
    // Check if token exists and fetch user profile
    const token = localStorage.getItem('token');
    if (token && !user) {
      fetchUserProfile();
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getProfile();
      const normalizedUser = normalizeUser(response.data);
      setUser(normalizedUser);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError('Session expired. Please login again.');
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login(email, password);
      
      // Backend returns user data directly with token at top level
      const { token, ...userData } = response.data;
      
      const normalizedUser = normalizeUser(userData);
      localStorage.setItem('token', token);
      setUser(normalizedUser);
      
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verify = async (email: string, otp: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.verify(email, otp);
      
      const { token, message } = response.data;
      localStorage.setItem('token', token);
      
      // After verification, we might need to fetch the profile to get full user data
      await fetchUserProfile();
      
    } catch (err: any) {
      console.error('Verification failed:', err);
      setError(err.response?.data?.message || 'Verification failed. Please check the code.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.resendOTP(email);
    } catch (err: any) {
      console.error('Resend OTP failed:', err);
      setError(err.response?.data?.message || 'Failed to resend OTP.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const register = async (userData: { name: string, email: string, password: string, role: string }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.register(userData);
      
      // If the backend says verification is required, we don't set the user yet
      if (response.data.requiresVerification) {
        return response.data;
      }
      
      const { token, ...newUser } = response.data;
      const normalizedUser = normalizeUser(newUser);
      localStorage.setItem('token', token);
      setUser(normalizedUser);
      
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const updateProfile = async (userData: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert frontend field names to backend field names for sending
      const backendData: any = {};
      if (userData.name !== undefined) backendData.name = userData.name;
      if (userData.avatar !== undefined) backendData.profilePicture = userData.avatar;
      if (userData.coverPhoto !== undefined) backendData.coverPhoto = userData.coverPhoto;
      if (userData.bio !== undefined) backendData.bio = userData.bio;
      if (userData.linkedin !== undefined) backendData.linkedin = userData.linkedin;
      if (userData.github !== undefined) backendData.github = userData.github;
      if (userData.portfolio !== undefined) backendData.portfolio = userData.portfolio;
      
      const response = await authAPI.updateProfile(backendData);
      const normalizedUser = normalizeUser(response.data);
      setUser(normalizedUser);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    } catch (err: any) {
      console.error('Profile update failed:', err);
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (passwordData: { currentPassword: string, newPassword: string }) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.changePassword(passwordData);
    } catch (err: any) {
      console.error('Password change failed:', err);
      setError(err.response?.data?.message || 'Failed to change password.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordOTP = async (currentPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.requestPasswordOTP(currentPassword);
    } catch (err: any) {
      console.error('Request password OTP failed:', err);
      setError(err.response?.data?.message || 'Failed to send verification code.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyPasswordChange = async (data: { currentPassword: string, newPassword: string, otp: string }) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.verifyPasswordChange(data);
    } catch (err: any) {
      console.error('Verify password change failed:', err);
      setError(err.response?.data?.message || 'Verification failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({ 
    user, 
    isAuthenticated, 
    loading,
    error,
    login, 
    verify,
    resendOTP,
    logout, 
    register,
    updateProfile,
    changePassword,
    requestPasswordOTP,
    verifyPasswordChange
  }), [user, isAuthenticated, loading, error, login, verify, resendOTP, logout, register, updateProfile, changePassword, requestPasswordOTP, verifyPasswordChange]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
