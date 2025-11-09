/**
 * DepositDialog Component
 * 
 * Modal dialog for collecting new deposits for invoices
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
  Grid,
} from '@mui/material';
import {
  AccountBalance,
  Payment,
} from '@mui/icons-material';
import { invoicesService, paymentMethodsService, Invoice, PaymentMethod } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount, validateRequired } from '../../utils/validation';
import { useCurrencyFormatter } from '../../utils/currency';

interface DepositDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onDepositCollected: () => void;
}

export const DepositDialog: React.FC<DepositDialogProps> = ({
  open,
  onClose,
  invoice,
  onDepositCollected,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { formatCurrency } = useCurrencyFormatter();

  // Load payment methods
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const loadPaymentMethods = async () => {
      try {
        const methods = await paymentMethodsService.list();
        if (!mounted) return;
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedMethod(methods[0]);
        }
        setError('');
      } catch (error: any) {
        if (!mounted) return;
        console.error('Failed to load payment methods:', error);
        if (error?.response?.status === 401 && retryCount < 2) {
          retryCount += 1;
          timeoutId = setTimeout(() => {
            if (mounted) loadPaymentMethods();
          }, 1000);
        } else {
          setError('Failed to load payment methods');
        }
      }
    };

    if (open) {
      loadPaymentMethods();
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setReferenceNumber('');
      setTransactionId('');
      setNotes('');
      setError('');
    }
  }, [open]);

  // Handle submit
  const handleSubmit = async () => {
    setError('');

    // Frontend validation
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amountValidation = validateAmount(amount, 0.01);
    if (!amountValidation.valid) {
      setError(amountValidation.error!);
      return;
    }

    if (selectedMethod.requires_reference) {
      const refValidation = validateRequired(referenceNumber, 'Reference number');
      if (!refValidation.valid) {
        setError(refValidation.error!);
        return;
      }
    }

    setProcessing(true);

    try {
      // Process as a deposit payment type
      const result = await invoicesService.processPayment(invoice.id, {
        amount: amount,
        payment_method: selectedMethod.id,
        payment_type: 'deposit',
        reference: referenceNumber || undefined,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
        idempotency_key: `deposit-${invoice.id}-${Date.now()}`,
        version: invoice.version,
      });

      showSnackbar(result.message || 'Deposit collected successfully', 'success');
      
      onDepositCollected();
      onClose();
    } catch (error: any) {
      handleApiError(error, showSnackbar);
      setError(error?.response?.data?.error || 'Failed to collect deposit');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <AccountBalance color="primary" sx={{ mr: 1 }} />
          Collect Deposit
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          {/* Invoice Info */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invoice Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Invoice:</strong> {invoice.invoice_number}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Guest:</strong> {invoice.guest_name}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Total:</strong> {formatCurrency(invoice.total)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="primary">
                  <strong>Balance Due:</strong> {formatCurrency(invoice.balance_due)}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Payment Method */}
          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={selectedMethod?.id || ''}
              onChange={(e) => {
                const method = paymentMethods.find(m => m.id === e.target.value);
                setSelectedMethod(method || null);
              }}
              label="Payment Method"
            >
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  <Box display="flex" alignItems="center" width="100%">
                    <Typography sx={{ mr: 1 }}>{method.icon}</Typography>
                    <Typography>{method.name}</Typography>
                    {method.requires_reference && (
                      <Chip
                        label="Reference Required"
                        size="small"
                        color="warning"
                        sx={{ ml: 'auto' }}
                      />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Amount */}
          <TextField
            fullWidth
            required
            label="Deposit Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            helperText="Enter the deposit amount to collect"
            placeholder="0.00"
          />

          {/* Reference Number (if required) */}
          {selectedMethod?.requires_reference && (
            <TextField
              fullWidth
              required
              label="Reference Number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              helperText={`${selectedMethod.name} reference number (e.g., last 4 digits)`}
              placeholder="Enter reference number"
            />
          )}

          {/* Transaction ID */}
          <TextField
            fullWidth
            label="Transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            helperText="Optional transaction ID from payment processor"
            placeholder="Enter transaction ID"
          />

          {/* Notes */}
          <TextField
            fullWidth
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            helperText="Optional notes about this deposit"
            placeholder="Enter any additional notes"
          />

          {/* Error Display */}
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="success.contrastText" gutterBottom>
                Deposit Summary
              </Typography>
              <Typography variant="body2" color="success.contrastText">
                <strong>Amount:</strong> {formatCurrency(amount)}
              </Typography>
              <Typography variant="body2" color="success.contrastText">
                <strong>Method:</strong> {selectedMethod?.name || 'Not selected'}
              </Typography>
              {referenceNumber && (
                <Typography variant="body2" color="success.contrastText">
                  <strong>Reference:</strong> {referenceNumber}
                </Typography>
              )}
              <Typography variant="caption" color="success.contrastText" display="block" sx={{ mt: 1 }}>
                This deposit will be recorded and can be applied to future invoices
              </Typography>
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
          color="primary"
          onClick={handleSubmit}
          disabled={processing || !selectedMethod || !amount || parseFloat(amount) <= 0}
          startIcon={processing ? <CircularProgress size={20} /> : <Payment />}
        >
          {processing ? 'Processing...' : `Collect Deposit ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>

      {SnackbarComponent}
    </Dialog>
  );
};
