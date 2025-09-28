import { api } from './api';

export interface EmployeeOption {
  id: number;
  full_name: string;
}

export const employeesApi = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/employees/', { params });
    const data = res.data as any;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },
  options: async () => {
    const res = await api.get('/employees/', { params: { active: true, ordering: 'user__username' } });
    const data = res.data as any;
    const employees = Array.isArray(data) ? data : (data?.results ?? []);
    return employees.map((e: any) => ({ id: e.id, full_name: e.full_name || e.user?.username } as EmployeeOption));
  },
};

