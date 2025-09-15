import { api } from './api';

export interface GuestCommunicationInput {
  communication_type: 'email' | 'sms' | 'phone' | 'in_person';
  subject: string;
  message: string;
}

export const guestCommunicationsService = {
  async list(guestId: number) {
    const res = await api.get(`/guests/${guestId}/`);
    return res.data?.communications ?? [];
  },
  async create(guestId: number, payload: GuestCommunicationInput) {
    const res = await api.post(`/guests/${guestId}/communications/`, payload);
    return res.data;
  },
};


