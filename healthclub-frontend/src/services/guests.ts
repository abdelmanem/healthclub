import { api } from './api';

export interface MembershipTierObject {
  id?: number;
  name: string;
  display_name: string;
}

export interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  date_of_birth?: string; // YYYY-MM-DD
  email: string;
  phone: string;
  membership_tier?: string | MembershipTierObject;
  addresses?: GuestAddress[];
  emergency_contacts?: EmergencyContact[];
  preferences?: GuestPreference[];
  communications?: GuestCommunication[];
}

export interface CreateGuestInput {
  first_name: string;
  last_name: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  date_of_birth?: string; // YYYY-MM-DD
  email: string;
  phone: string;
  membership_tier?: string | null;
  country?: string;
  medical_notes?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  marketing_emails?: boolean;
  addresses?: GuestAddress[];
  emergency_contacts?: EmergencyContact[];
}

export interface UpdateGuestInput extends Partial<CreateGuestInput> {
  addresses?: GuestAddress[];
  emergency_contacts?: EmergencyContact[];
}

export interface GuestAddress {
  id: number;
  address_type: 'home' | 'work' | 'billing';
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

export interface GuestPreference {
  id: number;
  service: number;
  service_name?: string;
  rating: number;
  notes?: string;
}

export interface GuestCommunication {
  id: number;
  communication_type: 'email' | 'sms' | 'phone' | 'in_person';
  subject: string;
  message: string;
  sent_at: string;
  sent_by_name?: string;
  is_successful?: boolean;
}

export interface HistoricalReservation {
  history_id: number;
  history_date: string;
  history_type: '+' | '~' | '-';
  id: number | null;
  guest: number;
  guest_name?: string;
  location?: number | null;
  location_name?: string | null;
  employee?: number | null;
  employee_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const guestsService = {
  async list(params?: { search?: string }): Promise<Guest[]> {
    const response = await api.get('/guests/', {
      params: params?.search ? { search: params.search } : undefined,
    });
    const data = response.data as Guest[] | PaginatedResponse<Guest>;
    if (Array.isArray(data)) {
      return data;
    }
    return data.results;
  },

  async retrieve(id: number): Promise<Guest> {
    const response = await api.get(`/guests/${id}/`);
    return response.data;
  },

  async create(payload: CreateGuestInput): Promise<Guest> {
    const response = await api.post('/guests/', payload);
    return response.data;
  },

  async update(id: number, payload: UpdateGuestInput): Promise<Guest> {
    const response = await api.patch(`/guests/${id}/`, payload);
    return response.data;
  },

  async reservationHistory(id: number): Promise<HistoricalReservation[]> {
    const response = await api.get(`/guests/${id}/reservation-history/`);
    const data = response.data as HistoricalReservation[] | PaginatedResponse<HistoricalReservation>;
    if (Array.isArray(data)) return data;
    return data.results;
  },
};


