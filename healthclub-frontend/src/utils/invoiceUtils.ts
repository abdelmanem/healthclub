/**
 * Utility functions for invoice and payment handling
 */

import dayjs from 'dayjs';
import { Invoice, Payment } from '../services/invoices';

/**
 * Format currency amount
 */
export const formatCurrency = (amount: string | number): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

/**
 * Calculate invoice age in days
 */
export const getInvoiceAge = (invoiceDate: string): number => {
  return dayjs().diff(dayjs(invoiceDate), 'days');
};

/**
 * Check if invoice is overdue
 */
export const isInvoiceOverdue = (invoice: Invoice): boolean => {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return false;
  }
  return dayjs().isAfter(dayjs(invoice.due_date)) && parseFloat(invoice.balance_due) > 0;
};

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status: Payment['status']) => {
  const colors = {
    pending: '#FF9800',
    completed: '#4CAF50',
    failed: '#F44336',
    refunded: '#9C27B0',
    cancelled: '#757575',
  };
  return colors[status] || '#757575';
};

/**
 * Calculate total tax from invoice items
 */
export const calculateTotalTax = (items: Invoice['items']): number => {
  return items.reduce((total, item) => {
    const tax = parseFloat(item.tax_amount || '0');
    return total + tax;
  }, 0);
};

/**
 * Get payment method icon
 */
export const getPaymentMethodIcon = (methodCode: string): string => {
  const icons: Record<string, string> = {
    cash: '💵',
    credit_card: '💳',
    debit_card: '💳',
    mobile_payment: '📱',
    bank_transfer: '🏦',
    check: '📝',
    gift_card: '🎁',
    account_credit: '💰',
    loyalty_points: '⭐',
    comp: '🎫',
  };
  return icons[methodCode] || '💰';
};

/**
 * Format invoice status for display
 */
export const formatInvoiceStatus = (status: Invoice['status']): string => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

/**
 * Calculate payment percentage
 */
export const calculatePaymentPercentage = (invoice: Invoice): number => {
  const total = parseFloat(invoice.total);
  const paid = parseFloat(invoice.amount_paid);
  if (total === 0) return 0;
  return Math.round((paid / total) * 100);
};

/**
 * Group payments by date
 */
export const groupPaymentsByDate = (payments: Payment[]): Record<string, Payment[]> => {
  return payments.reduce((groups, payment) => {
    const date = dayjs(payment.payment_date).format('YYYY-MM-DD');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(payment);
    return groups;
  }, {} as Record<string, Payment[]>);
};

/**
 * Calculate refund total
 */
export const calculateRefundTotal = (_payments: Payment[]): number => {
  // Refunds are no longer represented as negative payments; use Invoice.refunds API instead.
  return 0;
};

/**
 * Validate payment amount
 */
export const validatePaymentAmount = (
  amount: string,
  balanceDue: string
): { valid: boolean; error?: string } => {
  const amountValue = parseFloat(amount);
  const balanceValue = parseFloat(balanceDue);

  if (isNaN(amountValue)) {
    return { valid: false, error: 'Invalid amount format' };
  }

  if (amountValue <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  if (amountValue > balanceValue) {
    return { valid: false, error: 'Amount cannot exceed balance due' };
  }

  return { valid: true };
};

/**
 * Generate invoice PDF (placeholder for future implementation)
 */
export const generateInvoicePDF = async (invoice: Invoice): Promise<Blob> => {
  // TODO: Implement PDF generation using jsPDF or similar library
  throw new Error('PDF generation not yet implemented');
};

/**
 * Print invoice
 */
export const printInvoice = (invoiceId: number): void => {
  // Open invoice in new window and trigger print
  const printWindow = window.open(`/invoices/${invoiceId}/print`, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

/**
 * Get invoice status color for UI components
 */
export const getInvoiceStatusColor = (status: Invoice['status']) => {
  const colors = {
    draft: 'default',
    pending: 'warning',
    issued: 'info',
    partial: 'info',
    paid: 'success',
    overdue: 'error',
    cancelled: 'default',
    refunded: 'secondary',
  };
  return colors[status] || 'default';
};

/**
 * Calculate days until due date
 */
export const getDaysUntilDue = (dueDate: string): number => {
  return dayjs(dueDate).diff(dayjs(), 'days');
};

/**
 * Format date for display
 */
export const formatDate = (date: string, format: string = 'MMM D, YYYY'): string => {
  return dayjs(date).format(format);
};

/**
 * Calculate invoice totals
 */
export const calculateInvoiceTotals = (invoice: Invoice) => {
  const subtotal = parseFloat(invoice.subtotal || '0');
  const serviceCharge = parseFloat(invoice.service_charge || '0');
  const tax = parseFloat(invoice.tax || '0');
  const discount = parseFloat(invoice.discount || '0');
  const total = parseFloat(invoice.total || '0');
  const amountPaid = parseFloat(invoice.amount_paid || '0');
  const balanceDue = parseFloat(invoice.balance_due || '0');

  return {
    subtotal,
    serviceCharge,
    tax,
    discount,
    total,
    amountPaid,
    balanceDue,
    isPaid: balanceDue <= 0,
    isOverpaid: amountPaid > total,
  };
};

/**
 * Get payment method display name
 */
export const getPaymentMethodDisplayName = (methodCode: string): string => {
  const names: Record<string, string> = {
    cash: 'Cash',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    mobile_payment: 'Mobile Payment',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    gift_card: 'Gift Card',
    account_credit: 'Account Credit',
    loyalty_points: 'Loyalty Points',
    comp: 'Complimentary',
  };
  return names[methodCode] || methodCode.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};
