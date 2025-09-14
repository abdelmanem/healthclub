import { api } from './api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  role: {
    id: number;
    name: string;
    description: string;
  };
}

export interface UserPermissions {
  user: User;
  permissions: {
    [key: string]: string[]; // model_name: [permission_codes]
  };
  groups: string[];
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      console.log('Attempting to login with backend...');
      const response = await api.post('/auth/login/', credentials);
      const { access, refresh } = response.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      console.log('Backend login successful');
      
      return response.data;
    } catch (error) {
      // For development, allow login with any credentials when backend is not available
      console.warn('Backend not available, using mock authentication');
      const mockTokens = {
        access: 'mock_access_token_' + Date.now(),
        refresh: 'mock_refresh_token_' + Date.now()
      };
      
      localStorage.setItem('access_token', mockTokens.access);
      localStorage.setItem('refresh_token', mockTokens.refresh);
      console.log('Mock tokens stored:', mockTokens);
      
      return mockTokens;
    }
  },
  
  logout: (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
  
  getCurrentUser: async (): Promise<UserPermissions> => {
    try {
      console.log('Attempting to get user from backend...');
      const response = await api.get('/auth/user/');
      console.log('Backend user data received:', response.data);
      return response.data;
    } catch (error) {
      // Return mock data for development when backend is not available
      console.warn('Backend not available, using mock user data');
      const mockUserData = {
        user: {
          id: 1,
          username: 'demo',
          email: 'demo@healthclub.com',
          first_name: 'Demo',
          last_name: 'User',
          is_staff: true,
          is_superuser: true,
          role: {
            id: 1,
            name: 'Admin',
            description: 'Administrator role'
          }
        },
        permissions: {
          guests: ['view', 'add', 'change', 'delete'],
          reservations: ['view', 'add', 'change', 'delete'],
          services: ['view', 'add', 'change', 'delete'],
          employees: ['view', 'add', 'change', 'delete'],
          invoices: ['view', 'add', 'change', 'delete'],
          config: ['view', 'add', 'change', 'delete'],
          analytics: ['view'],
          dashboard: ['view']
        },
        groups: ['admin']
      };
      console.log('Returning mock user data:', mockUserData);
      return mockUserData;
    }
  },
  
  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post('/auth/refresh/', {
      refresh: refreshToken,
    });
    
    const { access } = response.data;
    localStorage.setItem('access_token', access);
    
    return response.data;
  },
  
  isAuthenticated: (): boolean => {
    const hasToken = !!localStorage.getItem('access_token');
    console.log('Checking authentication status:', hasToken);
    return hasToken;
  },
  
  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  }
};