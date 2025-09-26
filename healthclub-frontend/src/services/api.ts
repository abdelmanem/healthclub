import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('No access token found, request may fail');
  }
  return config;
});

// Handle token refresh
let isRefreshing = false as boolean;
let pendingRequests: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  pendingRequests.push(callback);
}

function onRefreshed(token: string) {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401) {
      // Prevent infinite loop for the refresh endpoint itself
      const isRefreshCall = originalRequest?.url?.includes('/token/refresh/');
      if (isRefreshCall) {
        // Hard logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        if (isRefreshing) {
          // Queue this request until refresh finishes
          return new Promise((resolve) => {
            subscribeTokenRefresh((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }

        isRefreshing = true;
        console.log('401 error detected, attempting token refresh...');

        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) {
            console.warn('No refresh token found');
            throw new Error('No refresh token');
          }

          console.log('Refreshing token...');
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, { refresh: refreshToken });
          const { access } = response.data as { access: string };
          localStorage.setItem('access_token', access);
          console.log('Token refreshed successfully');
          onRefreshed(access);

          // Retry the original request
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;