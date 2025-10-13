/**
 * Invoice and Payment Service Client
 * 
 * Handles all API calls related to invoices and payments
 */

import { api } from './api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  requires_reference: boolean;
  icon?: string;
  display_order: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  service?: number;
  service_name?: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  line_total: string;
  tax_amount: string;
  total_with_tax: string;
  notes?: string;
}

export interface Payment {
  id: number;
  invoice: number;
  invoice_number: string;
  guest_name: string;
  method: string;
  payment_method?: number;
  payment_method_name?: string;
  payment_type: 'full' | 'partial' | 'deposit' | 'refund';
  amount: string;
  display_amount: string;
  transaction_id: string;
  reference_number: string;
  payment_date: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  notes: string;
  processed_by?: number;
  processed_by_name?: string;
  is_refund: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  guest: number;
  guest_name: string;
  guest_email?: string;
  reservation?: number;
  reservation_id?: number;
  date: string;
  due_date: string;
  subtotal: string;
  tax: string;
  service_charge: string;
  discount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  status: 'draft' | 'pending' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  paid_date?: string;
  notes: string;
  items: InvoiceItem[];
  payments: Payment[];
  payment_summary?: {
    total_payments: number;
    payment_methods: string[];
    refund_amount: string;
  };
  can_be_paid: boolean;
  can_be_refunded: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListItem {
  id: number;
  invoice_number: string;
  guest: number;
  guest_name: string;
  reservation?: number;
  date: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  status: Invoice['status'];
}

export interface ProcessPaymentRequest {
  amount: string;
  payment_method: number;
  payment_type?: 'full' | 'partial' | 'deposit';
  reference?: string;
  transaction_id?: string;
  notes?: string;
  idempotency_key?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  payment_id: number;
  amount_paid: string;
  invoice_total: string;
  amount_previously_paid: string;
  total_paid: string;
  balance_due: string;
  invoice_status: string;
  payment_status: string;
  loyalty_points_earned?: number;
  message: string;
}

export interface RefundRequest {
  amount: string;
  reason: string;
  payment_method?: string;
  notes?: string;
  payment_id?: number;
}

export interface RefundResponse {
  success: boolean;
  refund_id: number;
  refund_amount: string;
  refund_reason: string;
  remaining_paid: string;
  balance_due: string;
  invoice_status: string;
  loyalty_points_deducted?: number;
  message: string;
}

export interface InvoiceSummary {
  total_invoices: number;
  total_amount: string;
  total_paid: string;
  total_outstanding: string;
  average_invoice: string;
  by_status: Record<string, number>;
  pending_count: number;
  paid_count: number;
  overdue_count: number;
  partial_count: number;
  cancelled_count: number;
  refunded_count: number;
}

export interface PaymentSummary {
  total_payments: number;
  total_amount: string;
  total_refunds: string;
  net_revenue: string;
  average_payment: string;
  by_method: Record<string, string>;
  by_status: Record<string, number>;
  completed_count: number;
  pending_count: number;
  failed_count: number;
}

// ============================================================================
// API SERVICE
// ============================================================================

export const invoicesService = {
  /**
   * List all invoices with optional filtering
   * 
   * @param params - Filter parameters
   * @returns Array of invoices
   * 
   * @example
   * // Get all pending invoices
   * const invoices = await invoicesService.list({ status: 'pending' });
   * 
   * // Get invoices for a specific guest
   * const guestInvoices = await invoicesService.list({ guest: 15 });
   * 
   * // Get invoices in date range
   * const monthInvoices = await invoicesService.list({
   *   start_date: '2025-01-01',
   *   end_date: '2025-01-31'
   * });
   */
  async list(params?: {
    guest?: number;
    reservation?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    min_amount?: string;
    max_amount?: string;
    has_balance?: boolean;
    is_overdue?: boolean;
  }): Promise<InvoiceListItem[]> {
    const response = await api.get('/invoices/', { params });
    return response.data.results ?? response.data;
  },

  /**
   * Get single invoice with full details
   * 
   * @param id - Invoice ID
   * @returns Invoice with items and payments
   * 
   * @example
   * const invoice = await invoicesService.retrieve(42);
   * console.log(invoice.items);  // Line items
   * console.log(invoice.payments);  // Payment history
   */
  async retrieve(id: number): Promise<Invoice> {
    const response = await api.get(`/invoices/${id}/`);
    return response.data;
  },

  /**
   * Create new invoice
   * 
   * @param data - Invoice data
   * @returns Created invoice
   * 
   * @example
   * const invoice = await invoicesService.create({
   *   guest: 15,
   *   reservation: 100,
   *   items: [
   *     {
   *       product_name: 'Swedish Massage 60min',
   *       quantity: 1,
   *       unit_price: '80.00',
   *       tax_rate: '8.00'
   *     }
   *   ]
   * });
   */
  async create(data: {
    guest: number;
    reservation?: number;
    discount?: string;
    notes?: string;
    items: Array<{
      service?: number;
      product_name: string;
      quantity: number;
      unit_price: string;
      tax_rate?: string;
      notes?: string;
    }>;
  }): Promise<Invoice> {
    const response = await api.post('/invoices/', data);
    return response.data;
  },

  /**
   * Update existing invoice
   * 
   * @param id - Invoice ID
   * @param data - Updated data
   * @returns Updated invoice
   * 
   * @example
   * const updated = await invoicesService.update(42, {
   *   discount: '10.00',
   *   notes: 'Applied loyalty discount'
   * });
   */
  async update(id: number, data: Partial<{
    discount: string;
    notes: string;
    due_date: string;
    items: Array<{
      service?: number;
      product_name: string;
      quantity: number;
      unit_price: string;
      tax_rate?: string;
    }>;
  }>): Promise<Invoice> {
    const response = await api.patch(`/invoices/${id}/`, data);
    return response.data;
  },

  /**
   * Delete invoice
   * 
   * @param id - Invoice ID
   * 
   * @example
   * await invoicesService.delete(42);
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/invoices/${id}/`);
  },

  /**
   * Process payment for invoice
   * 
   * @param invoiceId - Invoice ID
   * @param data - Payment data
   * @returns Payment result
   * 
   * @example
   * const result = await invoicesService.processPayment(42, {
   *   amount: '108.00',
   *   payment_method: 2,  // Credit card
   *   payment_type: 'full',
   *   reference: 'VISA-4532',
   *   notes: 'Paid by Visa ending in 4532'
   * });
   */
  async processPayment(
    invoiceId: number,
    data: ProcessPaymentRequest
  ): Promise<ProcessPaymentResponse> {
    const response = await api.post(`/invoices/${invoiceId}/process_payment/`, data);
    return response.data;
  },

  /**
   * Process refund for invoice
   * 
   * @param invoiceId - Invoice ID
   * @param data - Refund data
   * @returns Refund result
   * 
   * @example
   * const result = await invoicesService.refund(42, {
   *   amount: '50.00',
   *   reason: 'Guest cancelled - partial refund per policy'
   * });
   */
  async refund(
    invoiceId: number,
    data: RefundRequest
  ): Promise<RefundResponse> {
    const response = await api.post(`/invoices/${invoiceId}/refund/`, data);
    return response.data;
  },

  /**
   * Mark invoice as paid (creates payment for full balance)
   * 
   * @param invoiceId - Invoice ID
   * @param data - Payment method and notes
   * @returns Result
   * 
   * @example
   * await invoicesService.markPaid(42, {
   *   method: 'cash',
   *   notes: 'Paid in full - cash'
   * });
   */
  async markPaid(
    invoiceId: number,
    data: { method?: string; notes?: string }
  ): Promise<{ success: boolean; payment_id: number; amount: string; message: string }> {
    const response = await api.post(`/invoices/${invoiceId}/mark-paid/`, data);
    return response.data;
  },

  /**
   * Cancel invoice
   * 
   * @param invoiceId - Invoice ID
   * @param data - Cancellation reason
   * @returns Result
   * 
   * @example
   * await invoicesService.cancel(42, {
   *   reason: 'Guest no-show'
   * });
   */
  async cancel(
    invoiceId: number,
    data: { reason?: string }
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/invoices/${invoiceId}/cancel/`, data);
    return response.data;
  },

  /**
   * Get payment history for invoice
   * 
   * @param invoiceId - Invoice ID
   * @returns Payment history
   * 
   * @example
   * const history = await invoicesService.paymentHistory(42);
   * console.log(history.payments);  // All payments
   */
  async paymentHistory(invoiceId: number): Promise<{
    invoice_number: string;
    guest_name: string;
    total: string;
    amount_paid: string;
    balance_due: string;
    status: string;
    payment_count: number;
    payments: Payment[];
  }> {
    const response = await api.get(`/invoices/${invoiceId}/payment-history/`);
    return response.data;
  },

  /**
   * Get invoice summary statistics
   * 
   * @param params - Filter parameters
   * @returns Summary statistics
   * 
   * @example
   * const summary = await invoicesService.summary({
   *   start_date: '2025-01-01',
   *   end_date: '2025-01-31'
   * });
   * console.log(summary.total_amount);  // Total billed
   * console.log(summary.total_outstanding);  // Unpaid amount
   */
  async summary(params?: {
    start_date?: string;
    end_date?: string;
    guest?: number;
  }): Promise<InvoiceSummary> {
    const response = await api.get('/invoices/summary/', { params });
    return response.data;
  },

  /**
   * Apply discount to invoice
   * 
   * @param invoiceId - Invoice ID
   * @param data - Discount data
   * @returns Result
   * 
   * @example
   * const result = await invoicesService.applyDiscount(42, {
   *   discount: '10.00',
   *   reason: 'Loyalty member - 10% off'
   * });
   */
  async applyDiscount(
    invoiceId: number,
    data: { discount: string; reason?: string }
  ): Promise<{
    success: boolean;
    previous_total: string;
    discount_applied: string;
    new_total: string;
    new_balance_due: string;
    message: string;
  }> {
    const response = await api.post(`/invoices/${invoiceId}/apply_discount/`, data);
    return response.data;
  },

  /**
   * Send invoice to guest via email
   * 
   * @param invoiceId - Invoice ID
   * @param data - Email data
   * @returns Result
   * 
   * @example
   * await invoicesService.sendToGuest(42, {
   *   email: 'guest@example.com',
   *   message: 'Thank you for visiting!'
   * });
   */
  async sendToGuest(
    invoiceId: number,
    data: { email?: string; message?: string }
  ): Promise<{ success: boolean; sent_to: string; message: string }> {
    const response = await api.post(`/invoices/${invoiceId}/send-to-guest/`, data);
    return response.data;
  },
};

export const paymentsService = {
  /**
   * List all payments with optional filtering
   * 
   * @param params - Filter parameters
   * @returns Array of payments
   * 
   * @example
   * // Get all payments for an invoice
   * const payments = await paymentsService.list({ invoice: 42 });
   * 
   * // Get all credit card payments
   * const cardPayments = await paymentsService.list({ method: 'credit_card' });
   * 
   * // Get payments in date range
   * const monthPayments = await paymentsService.list({
   *   start_date: '2025-01-01',
   *   end_date: '2025-01-31'
   * });
   */
  async list(params?: {
    invoice?: number;
    guest?: number;
    status?: string;
    method?: string;
    payment_type?: string;
    start_date?: string;
    end_date?: string;
    min_amount?: string;
    max_amount?: string;
    processed_by?: number;
  }): Promise<Payment[]> {
    const response = await api.get('/payments/', { params });
    return response.data.results ?? response.data;
  },

  /**
   * Get single payment details
   * 
   * @param id - Payment ID
   * @returns Payment details
   * 
   * @example
   * const payment = await paymentsService.retrieve(1);
   */
  async retrieve(id: number): Promise<Payment> {
    const response = await api.get(`/payments/${id}/`);
    return response.data;
  },

  /**
   * Get payment summary statistics
   * 
   * @param params - Filter parameters
   * @returns Summary statistics
   * 
   * @example
   * const summary = await paymentsService.summary({
   *   start_date: '2025-01-01',
   *   end_date: '2025-01-31'
   * });
   * console.log(summary.total_amount);  // Total received
   * console.log(summary.by_method);  // Breakdown by method
   */
  async summary(params?: {
    start_date?: string;
    end_date?: string;
    guest?: number;
  }): Promise<PaymentSummary> {
    const response = await api.get('/payments/summary/', { params });
    return response.data;
  },

  /**
   * Get daily payment report
   * 
   * @param date - Report date (YYYY-MM-DD)
   * @returns Daily report
   * 
   * @example
   * const report = await paymentsService.dailyReport('2025-01-15');
   * console.log(report.total_amount);  // Total for the day
   * console.log(report.by_hour);  // Hourly breakdown
   */
  async dailyReport(date?: string): Promise<{
    date: string;
    total_payments: number;
    total_amount: string;
    total_refunds: string;
    net_revenue: string;
    by_method: Record<string, string>;
    by_hour: Array<{ hour: number; count: number; amount: string }>;
  }> {
    const response = await api.get('/payments/daily-report/', {
      params: { date }
    });
    return response.data;
  },
};

export const paymentMethodsService = {
  /**
   * Get list of active payment methods
   * 
   * @returns Array of payment methods
   * 
   * @example
   * const methods = await paymentMethodsService.list();
   * // Use in dropdown
   * methods.map(m => ({ value: m.id, label: m.name }))
   */
  async list(): Promise<PaymentMethod[]> {
    const response = await api.get('/payment-methods/');
    return response.data.results ?? response.data;
  },

  /**
   * Get single payment method details
   * 
   * @param id - Payment method ID
   * @returns Payment method details
   * 
   * @example
   * const method = await paymentMethodsService.retrieve(2);
   */
  async retrieve(id: number): Promise<PaymentMethod> {
    const response = await api.get(`/payment-methods/${id}/`);
    return response.data;
  },
};

// ============================================================================
// RESERVATION INTEGRATION SERVICE
// ============================================================================

export const reservationInvoiceService = {
  /**
   * Create invoice for completed reservation
   * 
   * @param reservationId - Reservation ID
   * @returns Invoice creation result
   * 
   * @example
   * const result = await reservationInvoiceService.createInvoice(123);
   * console.log(result.invoice_number);  // Generated invoice number
   */
  async createInvoice(reservationId: number): Promise<{
    success: boolean;
    invoice_id: number;
    invoice_number: string;
    total_amount: string;
    balance_due: string;
    invoice_status: string;
    subtotal: string;
    tax_amount: string;
    service_charge: string;
    message: string;
  }> {
    const response = await api.post(`/reservations/${reservationId}/create-invoice/`);
    return response.data;
  },

  /**
   * Get invoice status for reservation
   * 
   * @param reservationId - Reservation ID
   * @returns Invoice status information
   * 
   * @example
   * const status = await reservationInvoiceService.getInvoiceStatus(123);
   * console.log(status.has_invoice);  // true/false
   * console.log(status.can_create_invoice);  // true/false
   */
  async getInvoiceStatus(reservationId: number): Promise<{
    has_invoice: boolean;
    invoice_id?: number;
    invoice_number?: string;
    invoice_status?: string;
    total_amount?: string;
    balance_due?: string;
    amount_paid?: string;
    can_create_invoice: boolean;
    can_process_payment: boolean;
    can_refund: boolean;
    reason?: string;
  }> {
    const response = await api.get(`/reservations/${reservationId}/invoice-status/`);
    return response.data;
  },

  /**
   * Process payment for reservation invoice
   * 
   * @param reservationId - Reservation ID
   * @param data - Payment data
   * @returns Payment result
   * 
   * @example
   * const result = await reservationInvoiceService.processPayment(123, {
   *   amount: '108.00',
   *   payment_method: 2,
   *   payment_type: 'full',
   *   reference: 'VISA-4532'
   * });
   */
  async processPayment(
    reservationId: number,
    data: ProcessPaymentRequest
  ): Promise<ProcessPaymentResponse> {
    const response = await api.post(`/reservations/${reservationId}/process_payment/`, data);
    return response.data;
  },

  /**
   * Get payment history for reservation invoice
   * 
   * @param reservationId - Reservation ID
   * @returns Payment history
   * 
   * @example
   * const history = await reservationInvoiceService.getPaymentHistory(123);
   * console.log(history.payments);  // All payments for this reservation
   */
  async getPaymentHistory(reservationId: number): Promise<{
    invoice_number: string;
    guest_name: string;
    total: string;
    amount_paid: string;
    balance_due: string;
    status: string;
    payment_count: number;
    payments: Payment[];
  }> {
    const response = await api.get(`/reservations/${reservationId}/payment-history/`);
    return response.data;
  },
};
