/**
 * Custom React hooks for invoice and payment management
 */

import { useState, useEffect, useCallback } from 'react';
import { invoicesService, paymentsService, paymentMethodsService, Invoice, InvoiceListItem, PaymentMethod } from '../services/invoices';

/**
 * Hook for managing invoice list
 */
export const useInvoices = (params?: {
  guest?: number;
  reservation?: number;
  status?: string;
  autoLoad?: boolean;
}) => {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoicesService.list(params);
      setInvoices(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [params?.guest, params?.reservation, params?.status]);

  useEffect(() => {
    if (params?.autoLoad !== false) {
      loadInvoices();
    }
  }, [loadInvoices, params?.autoLoad]);

  return {
    invoices,
    loading,
    error,
    reload: loadInvoices,
  };
};

/**
 * Hook for managing single invoice
 */
export const useInvoice = (invoiceId: number | null) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await invoicesService.retrieve(invoiceId);
      setInvoice(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  return {
    invoice,
    loading,
    error,
    reload: loadInvoice,
  };
};

/**
 * Hook for managing payment methods
 */
export const usePaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const data = await paymentMethodsService.list();
        setPaymentMethods(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load payment methods');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentMethods();
  }, []);

  return {
    paymentMethods,
    loading,
    error,
  };
};

/**
 * Hook for managing invoice summary
 */
export const useInvoiceSummary = (params?: {
  start_date?: string;
  end_date?: string;
  guest?: number;
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoicesService.summary(params);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoice summary');
    } finally {
      setLoading(false);
    }
  }, [params?.start_date, params?.end_date, params?.guest]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return {
    summary,
    loading,
    error,
    reload: loadSummary,
  };
};

/**
 * Hook for managing payment summary
 */
export const usePaymentSummary = (params?: {
  start_date?: string;
  end_date?: string;
  guest?: number;
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentsService.summary(params);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment summary');
    } finally {
      setLoading(false);
    }
  }, [params?.start_date, params?.end_date, params?.guest]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return {
    summary,
    loading,
    error,
    reload: loadSummary,
  };
};

/**
 * Hook for managing payments
 */
export const usePayments = (params?: {
  invoice?: number;
  guest?: number;
  status?: string;
  method?: string;
  payment_type?: string;
  start_date?: string;
  end_date?: string;
  autoLoad?: boolean;
}) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentsService.list(params);
      setPayments(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [params?.invoice, params?.guest, params?.status, params?.method, params?.payment_type, params?.start_date, params?.end_date]);

  useEffect(() => {
    if (params?.autoLoad !== false) {
      loadPayments();
    }
  }, [loadPayments, params?.autoLoad]);

  return {
    payments,
    loading,
    error,
    reload: loadPayments,
  };
};

/**
 * Hook for processing payments
 */
export const usePaymentProcessing = () => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayment = useCallback(async (
    invoiceId: number,
    paymentData: {
      amount: string;
      payment_method: number;
      payment_type?: 'full' | 'partial' | 'deposit';
      reference?: string;
      transaction_id?: string;
      notes?: string;
    }
  ) => {
    setProcessing(true);
    setError(null);
    try {
      const result = await invoicesService.processPayment(invoiceId, paymentData);
      return result;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to process payment');
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  const processRefund = useCallback(async (
    invoiceId: number,
    refundData: {
      amount: string;
      reason: string;
      payment_method?: string;
      notes?: string;
    }
  ) => {
    setProcessing(true);
    setError(null);
    try {
      const result = await invoicesService.refund(invoiceId, refundData);
      return result;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to process refund');
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    processing,
    error,
    processPayment,
    processRefund,
  };
};
