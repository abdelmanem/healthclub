export interface SystemConfiguration {
  id: number;
  key: string;
  value: string;
  description: string;
  data_type: 'string' | 'integer' | 'decimal' | 'boolean' | 'json';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembershipTier {
  id: number;
  name: string;
  display_name: string;
  description: string;
  discount_percentage: number;
  priority_booking: boolean;
  free_services_count: number;
  min_spend_required: number;
  points_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

export interface GenderOption {
  id: number;
  code: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface BusinessRule {
  id: number;
  category: 'booking' | 'cancellation' | 'payment' | 'loyalty' | 'inventory' | 'employee';
  name: string;
  description: string;
  key: string;
  value: string;
  data_type: 'string' | 'integer' | 'decimal' | 'boolean' | 'json';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionType {
  id: number;
  name: string;
  description: string;
  percentage: number;
  is_active: boolean;
}

export interface TrainingType {
  id: number;
  name: string;
  description: string;
  duration_hours: number;
  is_active: boolean;
}

export interface ProductType {
  id: number;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface NotificationTemplate {
  id: number;
  name: string;
  type: 'email' | 'sms';
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
}
