import { api } from './api';

export interface Reservation {
  id: number;
  guest: number;
  service?: number;
  employee?: number | null;
  location?: number | null;
  start_time: string; // ISO
  end_time?: string; // ISO
  status?: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled';
  notes?: string;
}

export interface CreateReservationInput {
  guest: number;
  service: number;
  employee?: number | null;
  location?: number | null;
  start_time: string;
  notes?: string;
}

export const reservationsService = {
  async list(params?: Partial<{ guest: number; location: number; status: string | string[]; start_time__gte: string; start_time__lte: string }>): Promise<Reservation[]> {
    const response = await api.get('/reservations/', { params });
    const data = response.data as Reservation[] | { results: Reservation[] };
    if (Array.isArray(data)) return data;
    return data.results ?? [];
  },
  async create(payload: CreateReservationInput): Promise<Reservation> {
    const response = await api.post('/reservations/', payload);
    return response.data;
  },
  async availability(params: { service?: number; employee?: number; location?: number; start: string }): Promise<{ slots: string[] }> {
    const response = await api.get('/reservations/availability/', { params });
    return response.data;
  },
  async conflictCheck(payload: { service?: number; employee?: number; location?: number; start: string }): Promise<{ conflicts: any[] }> {
    const response = await api.post('/reservations/conflict-check/', payload);
    return response.data;
  },
};


