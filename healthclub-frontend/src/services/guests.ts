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
  email: string;
  phone: string;
  membership_tier?: string | null;
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
    // Backend requires membership_id (unique) and specific membership_tier codes
    const normalized: any = { ...payload };
    if (!('membership_id' in normalized) || !normalized.membership_id) {
      normalized.membership_id = `M-${Date.now()}`;
    }
    const response = await api.post('/guests/', normalized);
    return response.data;
  },

  async update(id: number, payload: UpdateGuestInput): Promise<Guest> {
    const response = await api.patch(`/guests/${id}/`, payload);
    return response.data;
  },
};


