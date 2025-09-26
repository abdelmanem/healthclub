import { api } from './api';

export interface EmployeeOption {
  id: number;
  full_name: string;
}

export const employeesApi = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/employees/', { params });
    return res.data as any[];
  },
  options: async () => {
    const res = await api.get('/employees/', { params: { active: true, ordering: 'user__username' } });
    return (res.data as any[]).map(e => ({ id: e.id, full_name: e.full_name || e.user?.username } as EmployeeOption));
  },
};

