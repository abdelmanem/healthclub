import { api } from './api';

export interface DashboardStats {
  total_guests: number;
  todays_reservations: number;
  active_services: number;
  todays_revenue: number;
  active_employees: number;
  recent_reservations: number;
  pending_reservations: number;
}

export const dashboardService = {
  async getStatistics(): Promise<DashboardStats> {
    const response = await api.get('/dashboards/statistics/');
    return response.data;
  },
};
