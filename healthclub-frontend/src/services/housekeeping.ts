import { api } from './api';

export interface HousekeepingTask {
  id: number;
  location: number;
  location_name?: string;
  reservation?: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: number | null;
  notes?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
}

export const housekeepingApi = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/housekeeping-tasks/', { params });
    const data = res.data as any;
    return Array.isArray(data) ? (data as HousekeepingTask[]) : (data?.results ?? []);
  },
  get: async (id: number) => {
    const res = await api.get(`/housekeeping-tasks/${id}/`);
    return res.data as HousekeepingTask;
  },
  create: async (payload: Partial<HousekeepingTask>) => {
    const res = await api.post('/housekeeping-tasks/', payload);
    return res.data as HousekeepingTask;
  },
  update: async (id: number, payload: Partial<HousekeepingTask>) => {
    const res = await api.patch(`/housekeeping-tasks/${id}/`, payload);
    return res.data as HousekeepingTask;
  },
  start: async (id: number) => {
    const res = await api.post(`/housekeeping-tasks/${id}/start/`);
    return res.data;
  },
  complete: async (id: number) => {
    const res = await api.post(`/housekeeping-tasks/${id}/complete/`);
    return res.data;
  },
  cancel: async (id: number) => {
    const res = await api.post(`/housekeeping-tasks/${id}/cancel/`);
    return res.data;
  },
};

