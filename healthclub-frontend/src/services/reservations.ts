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
  status?: 'booked' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'checked_out';
  notes?: string;
  // denormalized fields from backend
  guest_name?: string;
  location_name?: string;
  employee_name?: string;
  reservation_services?: ReservationService[];
  total_duration_minutes?: number;
  total_price?: number;
  // timeline fields (optional, provided by backend)
  checked_in_at?: string | null;
  in_service_at?: string | null;
  completed_at?: string | null;
  checked_out_at?: string | null;
  cancelled_at?: string | null;
  no_show_recorded_at?: string | null;
  // flags
  location_is_out_of_service?: boolean;
  is_first_for_guest?: boolean;
}

export interface CreateReservationInput {
  guest: number;
  service?: number; // Legacy field for single service
  services?: Array<{service: number, quantity?: number}>; // New field for multiple services
  reservation_services?: Array<{ service: number; quantity?: number }>; // Direct nested payload
  employee?: number | null;
  location?: number | null;
  start_time: string;
  end_time?: string;
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
    // Normalize payload to backend shape
    const body: any = {
      guest: payload.guest,
      // employee is not writable on backend serializer; omit it
      location: payload.location ?? null,
      start_time: payload.start_time,
      notes: payload.notes ?? undefined,
    };

    if (payload.end_time) {
      body.end_time = payload.end_time;
    }

    // Map single service -> reservation_services
    const servicesList: Array<{ service: number; quantity?: number }> = [];
    if (payload.service) {
      servicesList.push({ service: payload.service, quantity: 1 });
    }
    if (Array.isArray(payload.services) && payload.services.length > 0) {
      for (const s of payload.services) {
        if (s && typeof s.service === 'number') {
          servicesList.push({ service: s.service, quantity: s.quantity ?? 1 });
        }
      }
    }
    // Include directly provided reservation_services if present
    if (Array.isArray(payload.reservation_services) && payload.reservation_services.length > 0) {
      for (const s of payload.reservation_services) {
        if (s && typeof s.service === 'number') {
          servicesList.push({ service: s.service, quantity: s.quantity ?? 1 });
        }
      }
    }

    if (servicesList.length > 0) {
      body.reservation_services = servicesList;
    }

    const response = await api.post('/reservations/', body);
    return response.data;
  },
  async update(id: number, payload: Partial<CreateReservationInput>): Promise<Reservation> {
    const body: any = {};
    if (payload.guest !== undefined) body.guest = payload.guest;
    if (payload.location !== undefined) body.location = payload.location;
    if (payload.start_time !== undefined) body.start_time = payload.start_time;
    if (payload.end_time !== undefined) body.end_time = payload.end_time;
    if (payload.notes !== undefined) body.notes = payload.notes;

    const servicesList: Array<{ service: number; quantity?: number }> = [];
    if (Array.isArray(payload.reservation_services)) {
      for (const s of payload.reservation_services) {
        if (s && typeof s.service === 'number') servicesList.push({ service: s.service, quantity: s.quantity ?? 1 });
      }
    } else if (Array.isArray(payload.services)) {
      for (const s of payload.services) {
        if (s && typeof s.service === 'number') servicesList.push({ service: s.service, quantity: s.quantity ?? 1 });
      }
    } else if (payload.service) {
      servicesList.push({ service: payload.service, quantity: 1 });
    }
    if (servicesList.length > 0) body.reservation_services = servicesList;

    const response = await api.patch(`/reservations/${id}/`, body);
    return response.data;
  },
  async availability(params: { service?: number; services?: number[]; employee?: number; location?: number; start: string; exclude_reservation?: number }): Promise<{ available: boolean; reason?: string; overlaps?: number; capacity?: number }> {
    const response = await api.get('/reservations/availability/', { params });
    return response.data;
  },
  async conflictCheck(payload: { start_time: string; end_time: string; location: number | null; service?: number; services?: number[]; exclude_reservation?: number }): Promise<{ conflict: boolean; reason?: string; overlaps?: number; capacity?: number }> {
    const response = await api.post('/reservations/conflict-check/', payload);
    return response.data;
  },
  async checkIn(id: number, opts?: { allow_dirty?: boolean }): Promise<Reservation> {
    const body: any = {};
    if (opts?.allow_dirty) body.allow_dirty = true;
    const response = await api.post(`/reservations/${id}/check-in/`, body);
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
  async cancel(id: number, data?: { cancellation_reason?: number; notes?: string }): Promise<Reservation> {
    const response = await api.post(`/reservations/${id}/cancel/`, data || {});
    return response.data;
  },
  async createInvoice(id: number): Promise<{ invoice_id: number; invoice_number: string }> {
    const response = await api.post(`/reservations/${id}/create-invoice/`, {});
    return response.data;
  },
};


