import { api } from './api';

export interface NotificationItem {
  id: number;
  text: string;
  created_at?: string;
  is_read?: boolean;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const notificationsService = {
  async list(): Promise<NotificationItem[]> {
    try {
      const response = await api.get('/notifications/');
      const data = response.data as NotificationItem[] | PaginatedResponse<NotificationItem>;
      if (Array.isArray(data)) return data;
      return data.results;
    } catch (e) {
      // Gracefully fallback if endpoint not available yet
      return [];
    }
  },

  async markAllRead(): Promise<void> {
    try {
      await api.post('/notifications/mark-all-read/');
    } catch (e) {
      // ignore if endpoint not implemented
    }
  }
};


