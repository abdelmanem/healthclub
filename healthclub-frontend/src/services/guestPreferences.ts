import { api } from './api';

export interface GuestPreferenceInput {
  service: number;
  rating: number;
  notes?: string;
}

export const guestPreferencesService = {
  async list(guestId: number) {
    const res = await api.get(`/guests/${guestId}/preferences/`).catch(async () => api.get(`/guests/${guestId}/`));
    const data = res.data?.results ?? res.data ?? {};
    return Array.isArray(data) ? data : (data.preferences ?? []);
  },
  async create(guestId: number, payload: GuestPreferenceInput) {
    const res = await api.post(`/guests/${guestId}/preferences/`, payload);
    return res.data;
  },
  async delete(guestId: number, preferenceId: number) {
    await api.delete(`/guests/${guestId}/preferences/${preferenceId}/`);
  },
};


