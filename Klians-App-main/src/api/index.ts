import axios from 'axios';
import { getBackendUrl } from './config';

// Create axios instance with base URL
const API = axios.create({
  baseURL: `${getBackendUrl()}/api`
});

// Add request interceptor to include auth token in headers
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;