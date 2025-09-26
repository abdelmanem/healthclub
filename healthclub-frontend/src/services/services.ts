import { api } from './api';

export interface ServiceInput {
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  locations?: number[];
}

export interface ServiceRecord extends ServiceInput {
  id: number;
}

export const servicesApi = {
  list: async (params?: Record<string, any>): Promise<ServiceRecord[]> => {
    const res = await api.get('/services/', { params });
    return res.data as ServiceRecord[];
  },
  create: async (payload: ServiceInput): Promise<ServiceRecord> => {
    const res = await api.post('/services/', payload);
    return res.data as ServiceRecord;
  },
};

