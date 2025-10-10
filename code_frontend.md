2.2.5 Invoice Dashboard Component
/**
 * InvoiceDashboard Component
 * 
 * Main dashboard with statistics and invoice management
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  AttachMoney,
  Receipt,
  Warning,
} from '@mui/icons-material';
import { invoicesService, paymentsService, InvoiceSummary, PaymentSummary } from '../../services/invoices';
import { InvoiceList } from './InvoiceList';
import { InvoiceDetails } from './InvoiceDetails';
import dayjs from 'dayjs';

export const InvoiceDashboard: React.FC = () => {
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: dayjs().endOf('month').format('YYYY-MM-DD'),
  });

  // Load summaries
  const loadSummaries = async () => {
    setLoading(true);
    try {
      const [invSummary, paySummary] = await Promise.all([
        invoicesService.summary({
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
        paymentsService.summary({
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
      ]);
      setInvoiceSummary(invSummary);
      setPaymentSummary(paySummary);
    } catch (error) {
      console.error('Failed to load summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, [dateRange]);

  // Stat card component
  const StatCard = ({
    title,
    value,
    icon,
    color = 'primary',
    subtitle,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
    subtitle?: string;
  }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}.main`,
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Invoice & Payment Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview for {dayjs(dateRange.start).format('MMM D')} -{' '}
          {dayjs(dateRange.end).format('MMM D, YYYY')}
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Revenue */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={`$${parseFloat(paymentSummary?.net_revenue || '0').toFixed(2)}`}
            icon={<AttachMoney />}
            color="success"
            subtitle={`${paymentSummary?.completed_count || 0} payments`}
          />
        </Grid>

        {/* Total Invoiced */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Invoiced"
            value={`$${parseFloat(invoiceSummary?.total_amount || '0').toFixed(2)}`}
            icon={<Receipt />}
            color="primary"
            subtitle={`${invoiceSummary?.total_invoices || 0} invoices`}
          />
        </Grid>

        {/* Outstanding Balance */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Outstanding"
            value={`$${parseFloat(invoiceSummary?.total_outstanding || '0').toFixed(2)}`}
            icon={<TrendingUp />}
            color="warning"
            subtitle={`${invoiceSummary?.pending_count || 0} pending`}
          />
        </Grid>

        {/* Overdue Invoices */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overdue"
            value={invoiceSummary?.overdue_count || 0}
            icon={<Warning />}
            color="error"
            subtitle="Requires attention"
          />
        </Grid>
      </Grid>

      {/* Status Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Invoice Status Breakdown
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {invoiceSummary?.by_status &&
                  Object.entries(invoiceSummary.by_status).map(([status, count]) => (
                    <Box
                      key={status}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ textTransform: 'capitalize' }}
                      >
                        {status.replace('_', ' ')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 100,
                            height: 8,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${
                                ((count as number) /
                                  (invoiceSummary.total_invoices || 1)) *
                                100
                              }%`,
                              height: '100%',
                              bgcolor: 'primary.main',
                            }}
                          />
                        </Box>
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Method Breakdown
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {paymentSummary?.by_method &&
                  Object.entries(paymentSummary.by_method).map(([method, amount]) => (
                    <Box
                      key={method}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ textTransform: 'capitalize' }}
                      >
                        {method.replace('_', ' ')}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        ${parseFloat(amount as string).toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invoice List */}
      <InvoiceList
        onInvoiceClick={(invoice) => setSelectedInvoiceId(invoice.id)}
        onCreateClick={() => {
          // Handle create invoice
        }}
      />

      {/* Invoice Details Dialog */}
      <Dialog
        open={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        maxWidth="lg"
        fullWidth
      >
        {selectedInvoiceId && (
          <InvoiceDetails
            invoiceId={selectedInvoiceId}
            onClose={() => setSelectedInvoiceId(null)}
            onPaymentProcessed={() => {
              loadSummaries();
            }}
          />
        )}
      </Dialog>
    </Box>
  );
};

###################################

2.2.6 Integration with Reservation Management

/**
 * Update ReservationManagement component to handle invoice creation
 */

// Add to ReservationManagement.tsx

import { invoicesService } from '../../services/invoices';

// Inside the ReservationManagement component:

const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);

// Modify the check-out action
const performAction = async (action: 'check_in' | 'in_service' | 'complete' | 'check_out', reservation?: Reservation) => {
  const targetReservation = reservation || selectedReservation;
  if (!targetReservation) return;
  
  try {
    // ... existing code for other actions ...
    
    if (action === 'check_out') {
      // Check out the reservation
      await reservationsService.checkOut(targetReservation.id);
      
      // Auto-create invoice
      try {
        const invoiceResult = await reservationsService.createInvoice(targetReservation.id);
        setCreatedInvoiceId(invoiceResult.invoice_id);
        setInvoiceDialogOpen(true);
        
        setSnackbar({
          open: true,
          message: `Checked out. Invoice ${invoiceResult.invoice_number} created.`,
          severity: 'success',
        });
      } catch (invoiceError) {
        console.warn('Invoice creation failed:', invoiceError);
        setSnackbar({
          open: true,
          message: 'Checked out, but invoice creation failed.',
          severity: 'warning',
        });
      }
      
      // Room marked dirty and HK task created (handled by backend)
    }
    
    await loadReservations();
    if (!reservation) setDrawerOpen(false);
  } catch (e: any) {
    console.error('Action failed', e);
    setSnackbar({ open: true, message: e?.response?.data?.detail || 'Action failed', severity: 'error' });
  }
};

// Add Invoice Dialog
<Dialog
  open={invoiceDialogOpen}
  onClose={() => setInvoiceDialogOpen(false)}
  maxWidth="lg"
  fullWidth
>
  {createdInvoiceId && (
    <InvoiceDetails
      invoiceId={createdInvoiceId}
      onClose={() => setInvoiceDialogOpen(false)}
      onPaymentProcessed={() => {
        // Refresh data as needed
        loadReservations();
      }}
    />
  )}
</Dialog>


########################

2.3 Utility Functions

/**
 * Utility functions for invoice and payment handling
 */

// utils/invoiceUtils.ts

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
export const calculateRefundTotal = (payments: Payment[]): number => {
  return payments
    .filter((p) => p.payment_type === 'refund' && p.status === 'completed')
    .reduce((total, p) => total + Math.abs(parseFloat(p.amount)), 0);
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

2.4 React Hooks


/**
 * Custom React hooks for invoice and payment management
 */

// hooks/useInvoices.ts

import { useState, useEffect, useCallback } from 'react';
import { invoicesService, Invoice, InvoiceListItem } from '../services/invoices';

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

// hooks/useInvoice.ts

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

// hooks/usePaymentMethods.ts

import { paymentMethodsService, PaymentMethod } from '../services/invoices';

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


####################

2.5 Complete Integration Example


/**
 * Complete example of invoice workflow integration
 * 
 * This shows how all components work together
 */

// pages/InvoicesPage.tsx

import React, { useState } from 'react';
import { Box, Container, Tabs, Tab } from '@mui/material';
import { InvoiceDashboard } from '../components/invoices/InvoiceDashboard';
import { InvoiceList } from '../components/invoices/InvoiceList';
import { PageWrapper } from '../components/common/PageWrapper';

export const InvoicesPage: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <PageWrapper title="Invoices & Payments">
      <Container maxWidth="xl">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Dashboard" />
          <Tab label="All Invoices" />
          <Tab label="Pending" />
          <Tab label="Overdue" />
        </Tabs>

        {tab === 0 && <InvoiceDashboard />}
        {tab === 1 && <InvoiceList />}
        {tab === 2 && <InvoiceList status="pending" />}
        {tab === 3 && <InvoiceList status="overdue" />}
      </Container>
    </PageWrapper>
  );
};