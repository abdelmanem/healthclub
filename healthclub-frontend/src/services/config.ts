import { api } from './api';
import { 
  SystemConfiguration, 
  MembershipTier, 
  GenderOption, 
  BusinessRule,
  CommissionType,
  TrainingType,
  ProductType,
  NotificationTemplate,
  CancellationReason
} from '../types/config';

export const configService = {
  // Internal helper to unwrap paginated/non-paginated lists
  _unwrapList: <T>(response: any): T[] => {
    const data = response?.data;
    if (!data) return [] as T[];
    if (Array.isArray(data)) return data as T[];
    if (Array.isArray(data?.results)) return data.results as T[];
    return [] as T[];
  },

  // System Configuration
  getSystemConfigs: async (): Promise<SystemConfiguration[]> => {
    try {
      const response = await api.get('/config/system-configurations/');
      return configService._unwrapList<SystemConfiguration>(response);
    } catch (error) {
      // Return mock data for development when backend is not available
      console.warn('Backend not available, using mock data for system configs');
      return [
        {
          id: 1,
          key: 'club_name',
          value: 'Health Club Management System',
          description: 'Name of the health club',
          data_type: 'string' as const,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
  },

  updateSystemConfig: async (id: number, data: Partial<SystemConfiguration>): Promise<SystemConfiguration> => {
    const response = await api.patch(`/config/system-configurations/${id}/`, data);
    return response.data;
  },

  createSystemConfig: async (data: Omit<SystemConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<SystemConfiguration> => {
    const response = await api.post('/config/system-configurations/', data);
    return response.data;
  },

  // Membership Tiers
  getMembershipTiers: async (): Promise<MembershipTier[]> => {
    try {
      const response = await api.get('/config/membership-tiers/');
      return configService._unwrapList<MembershipTier>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for membership tiers');
      return [
        {
          id: 1,
          name: 'basic',
          display_name: 'Basic',
          description: 'Basic membership tier',
          discount_percentage: 0,
          priority_booking: false,
          free_services_count: 0,
          min_spend_required: 0,
          points_multiplier: 1,
          is_active: true,
          sort_order: 1
        }
      ];
    }
  },

  updateMembershipTier: async (id: number, data: Partial<MembershipTier>): Promise<MembershipTier> => {
    const response = await api.patch(`/config/membership-tiers/${id}/`, data);
    return response.data;
  },

  createMembershipTier: async (data: Omit<MembershipTier, 'id'>): Promise<MembershipTier> => {
    const response = await api.post('/config/membership-tiers/', data);
    return response.data;
  },

  // Gender Options
  getGenderOptions: async (): Promise<GenderOption[]> => {
    try {
      const response = await api.get('/config/gender-options/');
      return configService._unwrapList<GenderOption>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for gender options');
      return [
        {
          id: 1,
          code: 'M',
          display_name: 'Male',
          description: 'Male gender option',
          is_active: true,
          sort_order: 1
        },
        {
          id: 2,
          code: 'F',
          display_name: 'Female',
          description: 'Female gender option',
          is_active: true,
          sort_order: 2
        }
      ];
    }
  },

  updateGenderOption: async (id: number, data: Partial<GenderOption>): Promise<GenderOption> => {
    const response = await api.patch(`/config/gender-options/${id}/`, data);
    return response.data;
  },

  createGenderOption: async (data: Omit<GenderOption, 'id'>): Promise<GenderOption> => {
    const response = await api.post('/config/gender-options/', data);
    return response.data;
  },

  // Business Rules
  getBusinessRules: async (): Promise<BusinessRule[]> => {
    try {
      const response = await api.get('/config/business-rules/');
      return configService._unwrapList<BusinessRule>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for business rules');
      return [
        {
          id: 1,
          category: 'booking' as const,
          name: 'max_advance_booking_days',
          description: 'Maximum days in advance for booking',
          key: 'max_advance_booking_days',
          value: '30',
          data_type: 'integer' as const,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
  },

  updateBusinessRule: async (id: number, data: Partial<BusinessRule>): Promise<BusinessRule> => {
    const response = await api.patch(`/config/business-rules/${id}/`, data);
    return response.data;
  },

  createBusinessRule: async (data: Omit<BusinessRule, 'id' | 'created_at' | 'updated_at'>): Promise<BusinessRule> => {
    const response = await api.post('/config/business-rules/', data);
    return response.data;
  },

  // Commission Types
  getCommissionTypes: async (): Promise<CommissionType[]> => {
    try {
      const response = await api.get('/config/commission-types/');
      return configService._unwrapList<CommissionType>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for commission types');
      return [
        {
          id: 1,
          name: 'percentage',
          code: 'PCT',
          description: 'Percentage-based commission',
          percentage: 10,
          is_active: true,
          sort_order: 1
        }
      ];
    }
  },

  // Training Types
  getTrainingTypes: async (): Promise<TrainingType[]> => {
    try {
      const response = await api.get('/config/training-types/');
      return configService._unwrapList<TrainingType>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for training types');
      return [
        {
          id: 1,
          name: 'safety',
          description: 'Safety training',
          duration_hours: 2,
          is_active: true
        }
      ];
    }
  },

  // Product Types
  getProductTypes: async (): Promise<ProductType[]> => {
    try {
      const response = await api.get('/config/product-types/');
      return configService._unwrapList<ProductType>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for product types');
      return [
        {
          id: 1,
          name: 'supplement',
          description: 'Nutritional supplements',
          category: 'health',
          is_active: true
        }
      ];
    }
  },

  // Notification Templates
  getNotificationTemplates: async (): Promise<NotificationTemplate[]> => {
    try {
      const response = await api.get('/config/notification-templates/');
      return configService._unwrapList<NotificationTemplate>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for notification templates');
      return [
        {
          id: 1,
          name: 'booking_confirmation',
          type: 'email' as const,
          subject: 'Booking Confirmation',
          content: 'Your booking has been confirmed for {{date}} at {{time}}',
          variables: ['date', 'time'],
          is_active: true
        }
      ];
    }
  },

  // Cancellation Reasons
  getCancellationReasons: async (): Promise<CancellationReason[]> => {
    try {
      const response = await api.get('/config/cancellation-reasons/');
      return configService._unwrapList<CancellationReason>(response);
    } catch (error) {
      console.warn('Backend not available, using mock data for cancellation reasons');
      return [
        {
          id: 1,
          code: 'GUEST_REQ',
          name: 'Guest Request',
          description: 'Cancelled at guest request',
          sort_order: 10,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          code: 'NO_SHOW',
          name: 'No Show',
          description: 'Guest did not arrive for appointment',
          sort_order: 20,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 3,
          code: 'STAFF_UNAVAIL',
          name: 'Staff Unavailable',
          description: 'Staff member became unavailable',
          sort_order: 30,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 4,
          code: 'OTHER',
          name: 'Other',
          description: 'Other reason',
          sort_order: 40,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
  },

  createCancellationReason: async (data: Partial<CancellationReason>): Promise<CancellationReason> => {
    const response = await api.post('/config/cancellation-reasons/', data);
    return response.data;
  },

  updateCancellationReason: async (id: number, data: Partial<CancellationReason>): Promise<CancellationReason> => {
    const response = await api.patch(`/config/cancellation-reasons/${id}/`, data);
    return response.data;
  },

  deleteCancellationReason: async (id: number): Promise<void> => {
    await api.delete(`/config/cancellation-reasons/${id}/`);
  },

  // Utility functions
  getConfigValue: async (key: string, defaultValue?: any): Promise<any> => {
    try {
      const configs = await configService.getSystemConfigs();
      const config = configs.find(c => c.key === key && c.is_active);
      if (config) {
        // Type conversion based on data_type
        switch (config.data_type) {
          case 'integer':
            return parseInt(config.value);
          case 'decimal':
            return parseFloat(config.value);
          case 'boolean':
            return config.value.toLowerCase() === 'true';
          case 'json':
            return JSON.parse(config.value);
          default:
            return config.value;
        }
      }
      return defaultValue;
    } catch (error) {
      console.error('Failed to get config value:', error);
      return defaultValue;
    }
  }
};
