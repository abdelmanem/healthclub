import { api } from './api';

export interface SpaAppointment {
  id: string;
  customerName: string;
  serviceName: string;
  duration: number;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'new' | 'blocked' | 'completed';
  room?: string;
  price?: number;
  staffId: string;
  color: 'grey' | 'green' | 'red';
  customerId: string;
  serviceId: string;
  notes?: string;
}

export interface SpaStaff {
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
  isActive: boolean;
  services: string[];
}

export interface SpaSchedulingData {
  appointments: SpaAppointment[];
  staff: SpaStaff[];
  date: string;
}

export const spaSchedulingService = {
  // Get scheduling data for a specific date
  getSchedulingData: async (date: string): Promise<SpaSchedulingData> => {
    try {
      const response = await api.get(`/spa-scheduling/scheduling-data/${date}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching spa scheduling data:', error);
      throw error;
    }
  },

  // Get all staff members
  getStaff: async (): Promise<SpaStaff[]> => {
    try {
      const response = await api.get('/spa-scheduling/staff/');
      return response.data;
    } catch (error) {
      console.error('Error fetching staff:', error);
      throw error;
    }
  },

  // Create a new appointment
  createAppointment: async (appointment: Omit<SpaAppointment, 'id'>): Promise<SpaAppointment> => {
    try {
      const response = await api.post('/spa-scheduling/appointments/', appointment);
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Update an existing appointment
  updateAppointment: async (id: string, appointment: Partial<SpaAppointment>): Promise<SpaAppointment> => {
    try {
      const response = await api.patch(`/spa-scheduling/appointments/${id}/`, appointment);
      return response.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Delete an appointment
  deleteAppointment: async (id: string): Promise<void> => {
    try {
      await api.delete(`/spa-scheduling/appointments/${id}/`);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  },

  // Get available time slots for a staff member on a specific date
  getAvailableSlots: async (staffId: string, date: string): Promise<string[]> => {
    try {
      const response = await api.get(`/spa-scheduling/available-slots/${staffId}/${date}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw error;
    }
  }
};
