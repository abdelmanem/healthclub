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
    const data = res.data as any;
    return Array.isArray(data) ? (data as ServiceRecord[]) : (data?.results ?? []);
  },
  create: async (payload: ServiceInput): Promise<ServiceRecord> => {
    const res = await api.post('/services/', payload);
    return res.data as ServiceRecord;
  },
  update: async (id: number, payload: Partial<ServiceInput>): Promise<ServiceRecord> => {
    const res = await api.patch(`/services/${id}/`, payload);
    return res.data as ServiceRecord;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/services/${id}/`);
  },
};

export interface ServiceCategoryInput { name: string; description?: string }
export interface ServiceCategoryRecord extends ServiceCategoryInput { id: number }

export const serviceCategoriesApi = {
  list: async (): Promise<ServiceCategoryRecord[]> => {
    const res = await api.get('/service-categories/');
    const data = res.data as any;
    return Array.isArray(data) ? (data as ServiceCategoryRecord[]) : (data?.results ?? []);
  },
  create: async (payload: ServiceCategoryInput): Promise<ServiceCategoryRecord> => {
    const res = await api.post('/service-categories/', payload);
    return res.data as ServiceCategoryRecord;
  },
  update: async (id: number, payload: Partial<ServiceCategoryInput>): Promise<ServiceCategoryRecord> => {
    const res = await api.patch(`/service-categories/${id}/`, payload);
    return res.data as ServiceCategoryRecord;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/service-categories/${id}/`);
  },
};

