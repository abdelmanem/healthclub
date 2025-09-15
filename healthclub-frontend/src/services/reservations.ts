import { api } from './api';

export interface ReservationService {
  id: number;
  service: number;
  service_details?: {
    id: number;
    name: string;
    description: string;
    duration_minutes: number;
    price: string;
    category: string;
  };
  quantity: number;
  unit_price: string;
  total_price: string;
  service_duration_minutes: number;
}

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
  // denormalized fields from backend
  guest_name?: string;
  location_name?: string;
  employee_name?: string;
  reservation_services?: ReservationService[];
  total_duration_minutes?: number;
  total_price?: number;
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
  async retrieve(id: number): Promise<Reservation> {
    const response = await api.get(`/reservations/${id}/`);
    return response.data;
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
  async checkIn(id: number): Promise<Reservation> {
    const response = await api.post(`/reservations/${id}/check-in/`, {});
    return response.data;
  },
  async inService(id: number): Promise<Reservation> {
    const response = await api.post(`/reservations/${id}/in-service/`, {});
    return response.data;
  },
  async complete(id: number): Promise<Reservation> {
    const response = await api.post(`/reservations/${id}/complete/`, {});
    return response.data;
  },
  async checkOut(id: number): Promise<Reservation> {
    const response = await api.post(`/reservations/${id}/check-out/`, {});
    return response.data;
  },
};


