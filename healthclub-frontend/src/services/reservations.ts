import { api } from './api';

export interface Reservation {
  id: number;
  guest: number;
  service: number;
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
  async create(payload: CreateReservationInput): Promise<Reservation> {
    const response = await api.post('/reservations/', payload);
    return response.data;
  },
};


