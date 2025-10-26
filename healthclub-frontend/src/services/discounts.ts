import { api } from './api';

export interface DiscountType {
  id: number;
  name: string;
  code: string;
  description: string;
  discount_method: 'percentage' | 'fixed_amount' | 'free_service';
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount?: number;
  is_active: boolean;
  requires_approval: boolean;
  is_valid_now: boolean;
  applicable_services?: number[];
  applicable_membership_tiers?: number[];
  usage_limit_per_guest?: number;
  usage_limit_per_day?: number;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationDiscount {
  id: number;
  reservation: number;
  discount_type: DiscountType;
  discount_type_name: string;
  discount_type_code: string;
  applied_by: number;
  applied_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'cancelled';
  reason: string;
  notes: string;
  rejection_reason?: string;
  applied_at: string;
  approved_at?: string;
  rejected_at?: string;
  reservation_guest_name?: string;
}

export interface DiscountRule {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  priority: number;
  conditions: Record<string, any>;
  discount_type: number;
  discount_type_name: string;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
  is_valid_now: boolean;
}

export interface DiscountApplicationRequest {
  reservation_id: number;
  discount_type_id: number;
  reason?: string;
  notes?: string;
}

class DiscountService {
  // Discount Types
  async listDiscountTypes(params?: {
    is_active?: boolean;
    is_valid_now?: boolean;
    discount_method?: string;
    requires_approval?: boolean;
  }): Promise<DiscountType[]> {
    const response = await api.get('/discounts/discount-types/', { params });
    return response.data.results || response.data || [];
  }

  async getDiscountType(id: number): Promise<DiscountType> {
    const response = await api.get(`/discounts/discount-types/${id}/`);
    return response.data;
  }

  async createDiscountType(data: Partial<DiscountType>): Promise<DiscountType> {
    const response = await api.post('/discounts/discount-types/', data);
    return response.data;
  }

  async updateDiscountType(id: number, data: Partial<DiscountType>): Promise<DiscountType> {
    const response = await api.patch(`/discounts/discount-types/${id}/`, data);
    return response.data;
  }

  async deleteDiscountType(id: number): Promise<void> {
    await api.delete(`/discounts/discount-types/${id}/`);
  }

  async getDiscountTypeUsageStats(id: number): Promise<{
    total_usage: number;
    total_discount_amount: number;
    recent_usage: number;
  }> {
    const response = await api.get(`/discounts/discount-types/${id}/usage-stats/`);
    return response.data;
  }

  // Reservation Discounts
  async listReservationDiscounts(params?: {
    reservation?: number;
    discount_type?: number;
    status?: string;
    applied_by?: number;
    approved_by?: number;
    applied_at__gte?: string;
    applied_at__lte?: string;
  }): Promise<ReservationDiscount[]> {
    const response = await api.get('/discounts/reservation-discounts/', { params });
    return response.data.results || response.data || [];
  }

  async getReservationDiscount(id: number): Promise<ReservationDiscount> {
    const response = await api.get(`/discounts/reservation-discounts/${id}/`);
    return response.data;
  }

  async createReservationDiscount(data: {
    reservation: number;
    discount_type: number;
    reason?: string;
    notes?: string;
  }): Promise<ReservationDiscount> {
    const response = await api.post('/discounts/reservation-discounts/', data);
    return response.data;
  }

  async updateReservationDiscount(id: number, data: Partial<ReservationDiscount>): Promise<ReservationDiscount> {
    const response = await api.patch(`/discounts/reservation-discounts/${id}/`, data);
    return response.data;
  }

  async deleteReservationDiscount(id: number): Promise<void> {
    await api.delete(`/discounts/reservation-discounts/${id}/`);
  }

  async approveReservationDiscount(id: number, notes?: string): Promise<ReservationDiscount> {
    const response = await api.post(`/discounts/reservation-discounts/${id}/approve/`, { notes });
    return response.data;
  }

  async rejectReservationDiscount(id: number, reason?: string): Promise<ReservationDiscount> {
    const response = await api.post(`/discounts/reservation-discounts/${id}/reject/`, { reason });
    return response.data;
  }

  async cancelReservationDiscount(id: number, reason?: string): Promise<ReservationDiscount> {
    const response = await api.post(`/discounts/reservation-discounts/${id}/cancel/`, { reason });
    return response.data;
  }

  // Discount Application
  async applyDiscount(data: DiscountApplicationRequest): Promise<ReservationDiscount> {
    const response = await api.post('/discounts/discount-application/apply/', data);
    return response.data;
  }

  // Discount Rules
  async listDiscountRules(params?: {
    is_active?: boolean;
    priority?: number;
    priority__gte?: number;
    priority__lte?: number;
    created_at__gte?: string;
    created_at__lte?: string;
  }): Promise<DiscountRule[]> {
    const response = await api.get('/discounts/discount-rules/', { params });
    return response.data.results || response.data || [];
  }

  async getDiscountRule(id: number): Promise<DiscountRule> {
    const response = await api.get(`/discounts/discount-rules/${id}/`);
    return response.data;
  }

  async createDiscountRule(data: Partial<DiscountRule>): Promise<DiscountRule> {
    const response = await api.post('/discounts/discount-rules/', data);
    return response.data;
  }

  async updateDiscountRule(id: number, data: Partial<DiscountRule>): Promise<DiscountRule> {
    const response = await api.patch(`/discounts/discount-rules/${id}/`, data);
    return response.data;
  }

  async deleteDiscountRule(id: number): Promise<void> {
    await api.delete(`/discounts/discount-rules/${id}/`);
  }

  // Utility methods
  calculateDiscountAmount(discountType: DiscountType, originalAmount: number): number {
    let discountAmount = 0;

    if (discountType.discount_method === 'percentage') {
      discountAmount = originalAmount * (discountType.discount_value / 100);
      if (discountType.max_discount_amount) {
        discountAmount = Math.min(discountAmount, discountType.max_discount_amount);
      }
    } else if (discountType.discount_method === 'fixed_amount') {
      discountAmount = Math.min(discountType.discount_value, originalAmount);
    } else if (discountType.discount_method === 'free_service') {
      discountAmount = originalAmount;
    }

    return discountAmount;
  }

  formatDiscountValue(discountType: DiscountType): string {
    switch (discountType.discount_method) {
      case 'percentage':
        return `${discountType.discount_value}% off`;
      case 'fixed_amount':
        return `$${discountType.discount_value} off`;
      case 'free_service':
        return 'Free service';
      default:
        return 'Unknown discount';
    }
  }

  getDiscountStatusColor(status: string): string {
    switch (status) {
      case 'applied':
        return 'bg-emerald-100 text-emerald-700';
      case 'approved':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}

export const discountService = new DiscountService();
