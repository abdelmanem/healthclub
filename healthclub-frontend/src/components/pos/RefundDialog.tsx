/**
 * RefundDialog Component
 * 
 * Enhanced modal dialog for processing refunds with improved UX
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
  Divider,
  IconButton,
  Fade,
  Paper,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Undo as UndoIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { invoicesService, Invoice } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onRefundProcessed: () => void;
}

export const RefundDialog: React.FC<RefundDialogProps> = ({
  open,
  onClose,
  invoice,
  onRefundProcessed,
}) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [targetPaymentId, setTargetPaymentId] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(invoice.amount_paid);
      setReason('');
      setNotes('');
      setTargetPaymentId('');
      setError('');
    }
  }, [open, invoice]);

  // Handle submit
  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!reason.trim()) {
      setError('Please enter a reason for the refund');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    if (amountValue > parseFloat(invoice.amount_paid)) {
      setError('Refund amount cannot exceed amount paid');
      return;
    }

    setProcessing(true);

    try {
      const result = await invoicesService.refund(invoice.id, {
        amount: amount,
        reason: reason,
        notes: notes || undefined,
        payment_id: typeof targetPaymentId === 'number' ? targetPaymentId : undefined,
        version: invoice.version,
      });

      showSnackbar(result.message || 'Refund processed successfully', 'success');
      
      onRefundProcessed();
      onClose();
    } catch (error: any) {
      setError(error?.response?.data?.error || 'Failed to process refund');
      showSnackbar(error?.response?.data?.error || 'Failed to process refund', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Calculate remaining paid amount after refund
  const remainingPaid = parseFloat(invoice.amount_paid) - parseFloat(amount || '0');
  const newBalanceDue = parseFloat(invoice.total) - remainingPaid;
  const isFullRefund = parseFloat(amount || '0') === parseFloat(invoice.amount_paid);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'warning.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UndoIcon sx={{ color: 'warning.main', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Process Refund
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Invoice {invoice.invoice_number}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} disabled={processing} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Invoice Summary Card */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ReceiptIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Invoice Summary
              </Typography>
            </Stack>
            
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Total Amount
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatCurrency(invoice.total)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Amount Paid
                </Typography>
                <Chip 
                  label={formatCurrency(invoice.amount_paid)}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Current Balance
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatCurrency(invoice.balance_due)}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 1 }} />
              
              <Box 
                sx={{ 
                  p: 1.5, 
                  bgcolor: 'info.lighter', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'info.light',
                }}
              >
                <Typography variant="caption" color="info.dark" fontWeight={600}>
                  💰 Maximum refundable: {formatCurrency(invoice.amount_paid)}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Fade in>
              <Alert severity="error" variant="filled" onClose={() => setError('')}>
                {error}
              </Alert>
            </Fade>
          )}

          <Alert 
            severity="warning" 
            icon={<WarningIcon />}
            variant="outlined"
            sx={{ 
              borderWidth: 2,
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <Typography variant="body2" fontWeight={600} gutterBottom>
              ⚠️ Important Notice
            </Typography>
            <Typography variant="body2">
              This action will create a refund payment and update the invoice balance. 
              Loyalty points will be deducted from the guest's account.
            </Typography>
          </Alert>

          {/* Refund Amount */}
          <TextField
            label="Refund Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography fontWeight={600}>$</Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{
              min: 0.01,
              max: parseFloat(invoice.amount_paid),
              step: 0.01,
              style: { fontSize: '1.1rem', fontWeight: 600 }
            }}
            helperText={
              <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                <span>Enter amount to refund</span>
                <span style={{ fontWeight: 600 }}>Max: {formatCurrency(invoice.amount_paid)}</span>
              </Stack>
            }
            FormHelperTextProps={{
              component: 'div',
              sx: { display: 'flex', mx: 0 }
            }}
          />

          {/* Target Payment (optional) */}
          {invoice.payments && invoice.payments.length > 0 && (
            <TextField
              select
              label="Refund to Specific Payment (Optional)"
              value={targetPaymentId}
              onChange={(e) => setTargetPaymentId(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              helperText="Select a payment to refund to its original payment method"
              SelectProps={{ native: true }}
            >
              <option value="">Auto-select (recommended)</option>
              {invoice.payments
                .filter((p) => !p.is_refund && Number(p.amount) > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    Payment #{p.id} • {p.payment_method_name || p.method} • ${Math.abs(Number(p.amount)).toFixed(2)}
                  </option>
                ))}
            </TextField>
          )}

          {/* Reason */}
          <TextField
            label="Refund Reason *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="e.g., Guest cancelled service, Service not satisfactory, Product defect..."
            helperText="Required for audit purposes and will be logged in payment history"
          />

          {/* Additional Notes */}
          <TextField
            label="Internal Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Add any internal notes for staff reference..."
            helperText="For internal use only - not visible to guests"
          />

          {/* Refund Preview */}
          {amount && parseFloat(amount) > 0 && (
            <Fade in>
              <Paper
                elevation={0}
                sx={{ 
                  p: 3, 
                  bgcolor: isFullRefund ? 'error.lighter' : 'warning.lighter',
                  border: '2px solid',
                  borderColor: isFullRefund ? 'error.light' : 'warning.light',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <TrendingDownIcon sx={{ color: isFullRefund ? 'error.main' : 'warning.main' }} />
                  <Typography 
                    variant="subtitle1" 
                    fontWeight={600}
                    color={isFullRefund ? 'error.dark' : 'warning.dark'}
                  >
                    Refund Preview
                  </Typography>
                </Stack>
                
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={500}>
                      Refund Amount
                    </Typography>
                    <Typography 
                      variant="h6" 
                      fontWeight={700}
                      color={isFullRefund ? 'error.dark' : 'warning.dark'}
                    >
                      -{formatCurrency(amount)}
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Remaining Paid</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {formatCurrency(remainingPaid.toString())}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">New Balance Due</Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight={700}
                      color={newBalanceDue > 0 ? 'error.main' : 'success.main'}
                    >
                      {formatCurrency(newBalanceDue.toString())}
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  {isFullRefund ? (
                    <Alert severity="error" icon="🔴" sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Full refund - Invoice will be marked as refunded
                      </Typography>
                    </Alert>
                  ) : newBalanceDue > 0 ? (
                    <Alert severity="warning" icon="⚠️" sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Partial refund - Invoice will have remaining balance of {formatCurrency(newBalanceDue.toString())}
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="success" icon="✅" sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Invoice will be fully paid after refund
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </Fade>
          )}

          {/* Payment History Preview */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight={600}>
                Recent Payments
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {invoice.payments.slice(-3).reverse().map((payment) => (
                  <Box 
                    key={payment.id} 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        label={payment.payment_method_name || payment.method}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      color="success.main"
                    >
                      +{formatCurrency(Math.abs(parseFloat(payment.amount)).toString())}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={processing}
          size="large"
          sx={{ minWidth: 100 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color={isFullRefund ? 'error' : 'warning'}
          onClick={handleSubmit}
          disabled={processing || !reason.trim() || !amount || parseFloat(amount) <= 0}
          startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <UndoIcon />}
          size="large"
          sx={{ 
            minWidth: 180,
            fontWeight: 600,
          }}
        >
          {processing ? 'Processing...' : `Refund ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};