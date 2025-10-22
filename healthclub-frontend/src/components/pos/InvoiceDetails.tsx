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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Undo,
  Cancel,
  Email,
  Print,
  AccountBalance,
} from '@mui/icons-material';
import { invoicesService, Invoice } from '../../services/invoices';
import { PaymentDialog } from './PaymentDialog';
import { RefundDialog } from './RefundDialog';
import { DepositManagement } from './DepositManagement';
import { RefundsTab } from './RefundsTab';
import { DepositDialog } from './DepositDialog';
import { DepositHistory } from './DepositHistory';
import dayjs from 'dayjs';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useConfirmDialog } from '../common/useConfirmDialog';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount } from '../../utils/validation';

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
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'payments' | 'refunds'>('payments');

  const { showConfirmDialog, dialogProps } = useConfirmDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load invoice details (with cleanup to avoid setting state after unmount)
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
    let mounted = true;
    const doLoad = async () => {
      setLoading(true);
      try {
        const data = await invoicesService.retrieve(invoiceId);
        if (mounted) setInvoice(data);
        // Refunds are loaded in RefundsTab on demand
      } catch (error) {
        if (mounted) console.error('Failed to load invoice:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    doLoad();
    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  // Handle cancel invoice with optimistic locking
  const handleCancel = async () => {
    if (!invoice) return;

    const result = await showConfirmDialog({
      title: 'Cancel Invoice',
      message: `Cancel invoice ${invoice.invoice_number}? This cannot be undone.`,
      confirmText: 'Cancel Invoice',
      confirmColor: 'error',
      inputLabel: 'Cancellation Reason',
      inputRequired: true,
      inputMultiline: true,
      inputRows: 3,
      inputPlaceholder: 'e.g., Guest cancelled appointment',
    });

    if (!result.confirmed) return;

    setActionLoading(true);
    try {
      // ✅ Include version for optimistic locking
      const response = await invoicesService.cancel(invoice.id, { 
        reason: result.value!, 
        version: invoice.version 
      });
      
      // ✅ Update local state with new version
      setInvoice(prev => prev ? { 
        ...prev, 
        version: response.version,
        status: response.invoice_status as Invoice['status']
      } : null);
      
      showSnackbar('Invoice cancelled successfully', 'success');
      await loadInvoice();
      onInvoiceCancelled?.();
      
    } catch (error: any) {
      // ✅ Handle version conflict (409)
      if (error?.response?.status === 409) {
        showSnackbar(
          'Invoice was modified by another user. Refreshing...',
          'warning'
        );
        await loadInvoice(); // Reload to get latest version
      } else {
        handleApiError(error, showSnackbar, loadInvoice);
      }
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
      showSnackbar('Invoice sent successfully', 'success');
    } catch (error: any) {
      handleApiError(error, showSnackbar);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle apply discount with optimistic locking
  const handleApplyDiscount = async () => {
    if (!invoice) return;

    const discountResult = await showConfirmDialog({
      title: 'Apply Discount',
      message: `Current total: $${parseFloat(invoice.total).toFixed(2)}`,
      confirmText: 'Apply Discount',
      inputLabel: 'Discount Amount',
      inputRequired: true,
      inputType: 'number',
      inputPlaceholder: '10.00',
      inputHelperText: `Maximum: $${parseFloat(invoice.subtotal).toFixed(2)}`,
      maxValue: parseFloat(invoice.subtotal),
    });
    if (!discountResult.confirmed) return;

    // ✅ Frontend validation
    const amountValidation = validateAmount(
      discountResult.value!, 
      0.01, 
      parseFloat(invoice.subtotal)
    );
    
    if (!amountValidation.valid) {
      showSnackbar(amountValidation.error!, 'error');
      return;
    }

    const reasonResult = await showConfirmDialog({
      title: 'Discount Reason',
      message: 'Please provide a reason for this discount (optional)',
      confirmText: 'Continue',
      inputLabel: 'Reason',
      inputMultiline: true,
      inputRows: 3,
      inputPlaceholder: 'e.g., Loyalty member - 10% off',
    });

    // ✅ Optimistic update - update UI immediately
    const previousInvoice = { ...invoice };
    const discountAmount = parseFloat(discountResult.value!);
    const newTotal = parseFloat(invoice.total) - discountAmount;
    const newBalanceDue = parseFloat(invoice.balance_due) - discountAmount;
    
    setInvoice(prev => prev ? {
      ...prev,
      discount: discountAmount.toFixed(2),
      total: newTotal.toFixed(2),
      balance_due: newBalanceDue.toFixed(2),
    } : null);

    setActionLoading(true);
    try {
      const response = await invoicesService.applyDiscount(invoice.id, {
        discount: discountResult.value!,
        reason: reasonResult.value || undefined,
        version: invoice.version,
      });
      
      // ✅ Update with server response
      setInvoice(prev => prev ? {
        ...prev,
        discount: response.discount_applied,
        total: response.new_total,
        balance_due: response.new_balance_due,
        version: response.version || prev.version,
      } : null);
      
      showSnackbar('Discount applied successfully', 'success');
      
    } catch (error: any) {
      // ✅ Rollback on error
      setInvoice(previousInvoice);
      
      if (error?.response?.status === 409) {
        showSnackbar(
          'Invoice was modified by another user. Refreshing...',
          'warning'
        );
        await loadInvoice();
      } else {
        handleApiError(error, showSnackbar, loadInvoice);
      }
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
                {invoice.items.map((item) => {
                  const isDeposit = item.product_name.toLowerCase().includes('deposit');
                  return (
                    <TableRow 
                      key={item.id}
                      sx={{
                        backgroundColor: isDeposit ? 'success.light' : 'transparent',
                        opacity: isDeposit ? 0.1 : 1,
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.product_name}
                        </Typography>
                        {item.notes && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.notes}
                          </Typography>
                        )}
                        {isDeposit && (
                          <Chip 
                            label="Deposit" 
                            size="small" 
                            color="success" 
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
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
                  );
                })}
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab value="payments" label="Payments" />
          <Tab value="refunds" label="Refunds" />
        </Tabs>
      </Box>

      {/* Payment History */}
      {activeTab === 'payments' && invoice.payments && invoice.payments.length > 0 && (
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight={600}>
                            {payment.payment_type === 'deposit_application' ? 'Deposit Payment' : 'Payment'} -{' '}
                            {payment.payment_method_name || payment.method}
                          </Typography>
                          {payment.payment_type === 'deposit_application' && (
                            <Chip 
                              label="Deposit" 
                              size="small" 
                              color="info" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                        <Typography
                          variant="body1"
                          fontWeight={700}
                          color={'success.main'}
                        >
                          +{formatCurrency(Math.abs(parseFloat(payment.amount)).toString())}
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

      {activeTab === 'refunds' && (
        <RefundsTab invoiceId={invoice.id} />
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
              {invoice.can_be_paid && (
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<AccountBalance />}
                  onClick={() => setDepositDialogOpen(true)}
                >
                  Collect Deposit
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

      {/* Deposit Management */}
      {invoice && (
        <Box sx={{ mt: 3 }}>
          <DepositManagement
            invoiceId={invoice.id}
            guestName={invoice.guest_name}
            onDepositApplied={() => {
              loadInvoice();
              onPaymentProcessed?.();
            }}
          />
        </Box>
      )}

      {/* Deposit History */}
      {invoice && (
        <Box sx={{ mt: 3 }}>
          <DepositHistory
            invoiceId={invoice.id}
            guestName={invoice.guest_name}
            onDepositUpdated={() => {
              loadInvoice();
            }}
          />
        </Box>
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

      {/* Deposit Dialog */}
      {invoice && (
        <DepositDialog
          open={depositDialogOpen}
          onClose={() => setDepositDialogOpen(false)}
          invoice={invoice}
          onDepositCollected={() => {
            loadInvoice();
            onPaymentProcessed?.();
            setDepositDialogOpen(false);
          }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />

      {/* Snackbar */}
      {SnackbarComponent}
    </Box>
  );
};
