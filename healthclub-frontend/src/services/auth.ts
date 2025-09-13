import { api } from './api';
import { UserPermissions } from '../types/permissions';

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
  
  getCurrentUser: async (): Promise<UserPermissions> => {
    const response = await api.get('/auth/user/');
    return response.data;
  },

  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post('/auth/refresh/', {
      refresh: refreshToken,
    });
    
    localStorage.setItem('access_token', response.data.access);
    return response.data;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token');
  }
};
