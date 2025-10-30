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
import InvoiceDetails from './InvoiceDetails';
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
          console.log('Create invoice clicked');
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
            onPaymentProcessed={() => { loadSummaries(); }}
          />
        )}
      </Dialog>
    </Box>
  );
};
