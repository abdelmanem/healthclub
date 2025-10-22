/**
 * RefundDialog Component
 * 
 * Modal dialog for processing refunds
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
} from '@mui/material';
import {
  Warning as WarningIcon,
  Undo as UndoIcon,
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <UndoIcon color="warning" />
          <Typography variant="h6">Process Refund</Typography>
          <Chip 
            label={invoice.invoice_number} 
            size="small" 
            color="warning" 
            variant="outlined" 
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Invoice Summary */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invoice Summary
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Total Amount:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(invoice.total)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>
                  Amount Paid:
                </Typography>
                <Typography variant="body2" fontWeight={700} color="success.main">
                  {formatCurrency(invoice.amount_paid)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Current Balance:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(invoice.balance_due)}
                </Typography>
              </Box>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Maximum refund amount: {formatCurrency(invoice.amount_paid)}
              </Typography>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="warning" icon={<WarningIcon />}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Important: Refund Processing
            </Typography>
            <Typography variant="body2">
              This action will create a refund payment and update the invoice balance.
              Loyalty points will also be deducted from the guest's account.
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
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            inputProps={{
              min: 0.01,
              max: parseFloat(invoice.amount_paid),
              step: 0.01,
            }}
            helperText={`Maximum: ${formatCurrency(invoice.amount_paid)}`}
          />

          {/* Target Payment (optional) */}
          {invoice.payments && invoice.payments.length > 0 && (
            <TextField
              select
              label="Refund Against Payment (optional)"
              value={targetPaymentId}
              onChange={(e) => setTargetPaymentId(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              helperText="Choose a specific payment to refund back to its method"
              SelectProps={{ native: true }}
            >
              <option value="">Auto-select (any method)</option>
              {invoice.payments
                .filter((p) => !p.is_refund && Number(p.amount) > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} • {p.payment_method_name || p.method} • ${Math.abs(Number(p.amount)).toFixed(2)}
                  </option>
                ))}
            </TextField>
          )}

          {/* Reason */}
          <TextField
            label="Refund Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="e.g., Guest cancelled service, Service not satisfactory, Product defect..."
            helperText="This will be logged in the payment history and is required for audit purposes"
          />

          {/* Additional Notes */}
          <TextField
            label="Additional Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional internal notes for staff reference..."
            helperText="Internal notes only - not visible to guest"
          />

          {/* Refund Preview */}
          {amount && parseFloat(amount) > 0 && (
            <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, opacity: 0.1 }}>
              <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                Refund Preview
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Refund Amount:</Typography>
                  <Typography variant="body2" fontWeight={600} color="warning.dark">
                    -{formatCurrency(amount)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Remaining Paid:</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(remainingPaid.toString())}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">New Balance Due:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    color={newBalanceDue > 0 ? 'error.main' : 'success.main'}
                  >
                    {formatCurrency(newBalanceDue.toString())}
                  </Typography>
                </Box>
                {newBalanceDue === 0 && (
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    ✓ Invoice will be marked as fully refunded
                  </Typography>
                )}
                {newBalanceDue > 0 && (
                  <Typography variant="body2" color="warning.main" fontWeight={600}>
                    ⚠ Invoice will have remaining balance
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          {/* Payment History Preview */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Recent Payments
              </Typography>
              <Stack spacing={1}>
                {invoice.payments.slice(-3).map((payment) => (
                  <Box key={payment.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption">
                      Payment - {payment.payment_method_name || payment.method}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      fontWeight={600}
                      color={'success.main'}
                    >
                      +{formatCurrency(Math.abs(parseFloat(payment.amount)).toString())}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          disabled={processing || !reason.trim() || !amount || parseFloat(amount) <= 0}
          startIcon={processing ? <CircularProgress size={20} /> : <UndoIcon />}
        >
          {processing ? 'Processing...' : `Process Refund ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};
