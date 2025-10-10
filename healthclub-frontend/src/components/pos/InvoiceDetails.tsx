/**
 * InvoiceDetails Component
 * 
 * Displays complete invoice details with line items and payment history
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Stack,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Undo,
  Cancel,
  Email,
  Print,
} from '@mui/icons-material';
import { invoicesService, Invoice } from '../../services/invoices';
import { PaymentDialog } from './PaymentDialog';
import { RefundDialog } from './RefundDialog';
import dayjs from 'dayjs';

interface InvoiceDetailsProps {
  invoiceId: number;
  onClose?: () => void;
  onPaymentProcessed?: () => void;
  onRefundProcessed?: () => void;
  onInvoiceCancelled?: () => void;
}

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({
  invoiceId,
  onClose,
  onPaymentProcessed,
  onRefundProcessed,
  onInvoiceCancelled,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  // Load invoice details
  const loadInvoice = async () => {
    setLoading(true);
    try {
      const data = await invoicesService.retrieve(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  // Handle cancel invoice
  const handleCancel = async () => {
    if (!invoice) return;
    
    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    setActionLoading(true);
    try {
      await invoicesService.cancel(invoice.id, { reason });
      await loadInvoice();
      onInvoiceCancelled?.();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!invoice) return;

    setActionLoading(true);
    try {
      await invoicesService.sendToGuest(invoice.id, {});
      alert('Invoice sent successfully');
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to send invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle apply discount
  const handleApplyDiscount = async () => {
    if (!invoice) return;

    const discount = prompt('Enter discount amount:');
    if (!discount) return;

    const reason = prompt('Enter discount reason (optional):');

    setActionLoading(true);
    try {
      await invoicesService.applyDiscount(invoice.id, { 
        discount, 
        reason: reason || undefined 
      });
      await loadInvoice();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to apply discount');
    } finally {
      setActionLoading(false);
    }
  };

  // Status color
  const getStatusColor = (status: Invoice['status']) => {
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

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Alert severity="error">Invoice not found</Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                {invoice.invoice_number}
              </Typography>
              <Chip
                label={invoice.status}
                color={getStatusColor(invoice.status) as any}
                sx={{ textTransform: 'capitalize' }}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Email />}
                onClick={handleSendEmail}
                disabled={actionLoading}
              >
                Email
              </Button>
              <Button
                variant="outlined"
                startIcon={<Print />}
                onClick={() => window.print()}
              >
                Print
              </Button>
              {onClose && (
                <Button onClick={onClose}>Close</Button>
              )}
            </Stack>
          </Box>

          {/* Invoice Info */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Bill To
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {invoice.guest_name}
              </Typography>
              {invoice.guest_email && (
                <Typography variant="body2" color="text.secondary">
                  {invoice.guest_email}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Invoice Date:
                  </Typography>
                  <Typography variant="body2">
                    {dayjs(invoice.date).format('MMM D, YYYY')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Due Date:
                  </Typography>
                  <Typography variant="body2">
                    {dayjs(invoice.due_date).format('MMM D, YYYY')}
                  </Typography>
                </Box>
                {invoice.reservation_id && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Reservation:
                    </Typography>
                    <Typography variant="body2">
                      #{invoice.reservation_id}
                    </Typography>
                  </Box>
                )}
                {invoice.created_by_name && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Created By:
                    </Typography>
                    <Typography variant="body2">
                      {invoice.created_by_name}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Services / Items
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Tax Rate</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {item.product_name}
                      </Typography>
                      {item.notes && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {item.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell align="right">
                      {parseFloat(item.tax_rate).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.line_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ minWidth: 300 }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">
                    {formatCurrency(invoice.subtotal)}
                  </Typography>
                </Box>
                {parseFloat(invoice.service_charge) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Service Charge:</Typography>
                    <Typography variant="body2">
                      {formatCurrency(invoice.service_charge)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Tax:</Typography>
                  <Typography variant="body2">
                    {formatCurrency(invoice.tax)}
                  </Typography>
                </Box>
                {parseFloat(invoice.discount) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="success.main">
                      Discount:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      -{formatCurrency(invoice.discount)}
                    </Typography>
                  </Box>
                )}
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(invoice.total)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Amount Paid:
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(invoice.amount_paid)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography
                    variant="h6"
                    color={
                      parseFloat(invoice.balance_due) > 0
                        ? 'error.main'
                        : 'success.main'
                    }
                  >
                    Balance Due:
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color={
                      parseFloat(invoice.balance_due) > 0
                        ? 'error.main'
                        : 'success.main'
                    }
                  >
                    {formatCurrency(invoice.balance_due)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment History
            </Typography>
            <List>
              {invoice.payments.map((payment) => (
                <ListItem
                  key={payment.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" fontWeight={600}>
                          {payment.is_refund ? 'Refund' : 'Payment'} -{' '}
                          {payment.payment_method_name || payment.method}
                        </Typography>
                        <Typography
                          variant="body1"
                          fontWeight={700}
                          color={payment.is_refund ? 'error.main' : 'success.main'}
                        >
                          {payment.is_refund ? '-' : '+'}{formatCurrency(Math.abs(parseFloat(payment.amount)).toString())}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {dayjs(payment.payment_date).format('MMM D, YYYY h:mm A')}
                        </Typography>
                        {payment.reference_number && (
                          <Typography variant="caption" display="block">
                            Ref: {payment.reference_number}
                          </Typography>
                        )}
                        {payment.transaction_id && (
                          <Typography variant="caption" display="block">
                            Txn: {payment.transaction_id}
                          </Typography>
                        )}
                        {payment.notes && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {payment.notes}
                          </Typography>
                        )}
                        {payment.processed_by_name && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Processed by: {payment.processed_by_name}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {invoice.status !== 'cancelled' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {invoice.can_be_paid && (
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  Process Payment
                </Button>
              )}
              {invoice.can_be_refunded && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<Undo />}
                  onClick={() => setRefundDialogOpen(true)}
                >
                  Process Refund
                </Button>
              )}
              {invoice.status === 'pending' && parseFloat(invoice.amount_paid) === 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  Cancel Invoice
                </Button>
              )}
              {parseFloat(invoice.discount) === 0 && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleApplyDiscount}
                  disabled={actionLoading}
                >
                  Apply Discount
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {invoice.notes}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      {invoice.payment_summary && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Total Payments
                </Typography>
                <Typography variant="h6">
                  {invoice.payment_summary.total_payments}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Payment Methods
                </Typography>
                <Typography variant="body2">
                  {invoice.payment_summary.payment_methods.join(', ')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Refund Amount
                </Typography>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(invoice.payment_summary.refund_amount)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      {invoice && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          invoice={invoice}
          onPaymentProcessed={() => {
            loadInvoice();
            onPaymentProcessed?.();
            setPaymentDialogOpen(false);
          }}
        />
      )}

      {/* Refund Dialog */}
      {invoice && (
        <RefundDialog
          open={refundDialogOpen}
          onClose={() => setRefundDialogOpen(false)}
          invoice={invoice}
          onRefundProcessed={() => {
            loadInvoice();
            onRefundProcessed?.();
            setRefundDialogOpen(false);
          }}
        />
      )}
    </Box>
  );
};
