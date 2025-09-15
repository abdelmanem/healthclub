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
}

export interface CreateGuestInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  membership_tier?: string | null;
}

export interface UpdateGuestInput extends Partial<CreateGuestInput> {}

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
    if (normalized.membership_tier) {
      const mt = String(normalized.membership_tier).toLowerCase();
      // accept common names but backend expects enum keys
      const map: Record<string, string> = {
        bronze: 'bronze',
        silver: 'silver',
        gold: 'gold',
        platinum: 'platinum',
        vip: 'vip',
      };
      normalized.membership_tier = map[mt] || 'bronze';
    }
    const response = await api.post('/guests/', normalized);
    return response.data;
  },

  async update(id: number, payload: UpdateGuestInput): Promise<Guest> {
    const normalized: any = { ...payload };
    if (normalized.membership_tier) {
      const mt = String(normalized.membership_tier).toLowerCase();
      const map: Record<string, string> = {
        bronze: 'bronze',
        silver: 'silver',
        gold: 'gold',
        platinum: 'platinum',
        vip: 'vip',
      };
      normalized.membership_tier = map[mt] || 'bronze';
    }
    const response = await api.patch(`/guests/${id}/`, normalized);
    return response.data;
  },
};


