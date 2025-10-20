/**
 * DepositPaymentDialog Component
 * 
 * Modal dialog for processing deposit payments for reservations
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
  Divider,
} from '@mui/material';
import { PaymentMethod } from '../../services/invoices';
import { reservationsService, Reservation } from '../../services/reservations';
import { paymentMethodsService } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount, validateRequired } from '../../utils/validation';

interface DepositPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  onDepositPaid: () => void;
}

export const DepositPaymentDialog: React.FC<DepositPaymentDialogProps> = ({
  open,
  onClose,
  reservation,
  onDepositPaid,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(reservation.deposit_amount || '0');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { showSnackbar, SnackbarComponent } = useSnackbar();

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
      setAmount(reservation.deposit_amount || '0');
      setReferenceNumber('');
      setTransactionId('');
      setNotes('');
      setError('');
    }
  }, [open, reservation]);

  // Handle submit with proper validation and error handling
  const handleSubmit = async () => {
    setError('');

    // Frontend validation
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amountValidation = validateAmount(
      amount, 
      0.01, 
      parseFloat(reservation.deposit_amount || '0')
    );
    
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
      const result = await reservationsService.payDeposit(reservation.id, {
        amount: amount,
        payment_method: selectedMethod.id,
        reference: referenceNumber || undefined,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
      });

      showSnackbar(result.message || 'Deposit payment processed successfully', 'success');
      
      onDepositPaid();
      onClose();
    } catch (error: any) {
      handleApiError(error, showSnackbar);
      setError(error?.response?.data?.error || 'Failed to process deposit payment');
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Get deposit status color
  const getDepositStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'not_required':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography component="span" variant="h6">Pay Deposit</Typography>
          <Chip 
            label={`Reservation #${reservation.id}`} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Reservation Summary */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Reservation Details
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Guest:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {reservation.guest_name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Service:</Typography>
                <Typography variant="body2">
                  {reservation.reservation_services?.[0]?.service_details?.name || 'Multiple Services'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Date & Time:</Typography>
                <Typography variant="body2">
                  {new Date(reservation.start_time).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Status:</Typography>
                <Chip 
                  label={reservation.status?.replace('_', ' ').toUpperCase()} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Stack>
          </Box>

          {/* Deposit Information */}
          <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, opacity: 0.1 }}>
            <Typography variant="subtitle2" color="info.dark" gutterBottom>
              Deposit Information
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Required Amount:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(reservation.deposit_amount || '0')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Status:</Typography>
                <Chip 
                  label={reservation.deposit_status?.replace('_', ' ').toUpperCase()} 
                  size="small" 
                  color={getDepositStatusColor(reservation.deposit_status || 'not_required')}
                  variant="outlined"
                />
              </Box>
              {reservation.deposit_paid_at && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Paid At:</Typography>
                  <Typography variant="body2">
                    {new Date(reservation.deposit_paid_at).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Divider />

          {/* Payment Amount */}
          <TextField
            label="Deposit Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            disabled={reservation.deposit_paid}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            inputProps={{
              min: 0.01,
              max: parseFloat(reservation.deposit_amount || '0'),
              step: 0.01,
            }}
            helperText={`Required: ${formatCurrency(reservation.deposit_amount || '0')}`}
          />

          {/* Payment Method */}
          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={selectedMethod?.id || ''}
              onChange={(e) => {
                const method = paymentMethods.find((m) => m.id === e.target.value);
                setSelectedMethod(method || null);
                setReferenceNumber('');
              }}
              label="Payment Method"
            >
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {method.icon && <span>{method.icon}</span>}
                    <Typography>{method.name}</Typography>
                    {method.requires_reference && (
                      <Chip 
                        label="Ref Required" 
                        size="small" 
                        color="warning" 
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reference Number (if required) */}
          {selectedMethod?.requires_reference && (
            <TextField
              label="Reference Number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
              required
              placeholder="Last 4 digits, check number, etc."
              helperText={`Required for ${selectedMethod.name} payments`}
            />
          )}

          {/* Transaction ID (optional) */}
          <TextField
            label="Transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            fullWidth
            placeholder="Processor transaction ID (optional)"
            helperText="Optional: External transaction reference"
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Additional notes about this deposit payment..."
          />

          {/* Payment Preview */}
          {amount && parseFloat(amount) > 0 && (
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, opacity: 0.1 }}>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                Payment Preview
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Deposit Amount:</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(amount)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  ✓ Deposit will be marked as paid
                </Typography>
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
          onClick={handleSubmit}
          disabled={
            processing || 
            !selectedMethod || 
            !amount || 
            parseFloat(amount) <= 0 ||
            reservation.deposit_paid ||
            !reservation.can_pay_deposit
          }
          startIcon={processing ? <CircularProgress size={20} /> : undefined}
        >
          {processing ? 'Processing...' : `Pay Deposit ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};
