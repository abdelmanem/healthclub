import { api } from './api';

export interface Location {
  id: number;
  name: string;
  description?: string;
  capacity: number;
  is_active: boolean;
  gender: 'male' | 'female' | 'unisex';
  is_clean: boolean;
  is_occupied: boolean;
  is_out_of_service?: boolean;
}

export const locationsApi = {
  list: async (params?: Record<string, any>): Promise<Location[]> => {
    const res = await api.get('/locations/', { params });
    return res.data as Location[];
  },
  markClean: async (id: number) => {
    const res = await api.post(`/locations/${id}/mark-clean/`, {});
    return res.data;
  },
  markDirty: async (id: number) => {
    const res = await api.post(`/locations/${id}/mark-dirty/`, {});
    return res.data;
  },
  markOccupied: async (id: number) => {
    const res = await api.post(`/locations/${id}/mark-occupied/`, {});
    return res.data;
  },
  markVacant: async (id: number) => {
    const res = await api.post(`/locations/${id}/mark-vacant/`, {});
    return res.data;
  },
  outOfService: async (id: number) => {
    const res = await api.post(`/locations/${id}/out-of-service/`, {});
    return res.data;
  },
  backInService: async (id: number) => {
    const res = await api.post(`/locations/${id}/back-in-service/`, {});
    return res.data;
  },
};

