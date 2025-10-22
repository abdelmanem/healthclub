/**
 * PaymentDialog Component
 * 
 * Modal dialog for processing payments
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
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { invoicesService, paymentMethodsService, Invoice, PaymentMethod } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount, validateRequired } from '../../utils/validation';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPaymentProcessed: () => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  invoice,
  onPaymentProcessed,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(invoice.balance_due);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'deposit'>('full');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pay' | 'recent'>('pay');
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load payment methods (with cleanup to avoid memory leaks)
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
        setError(''); // Clear any previous errors
      } catch (error: any) {
        if (!mounted) return;
        console.error('Failed to load payment methods:', error);
        // If it's a 401 error and we haven't retried yet, wait a bit and retry
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
      setAmount(invoice.balance_due);
      setPaymentType('full');
      setReferenceNumber('');
      setTransactionId('');
      setNotes('');
      setError('');
      setActiveTab('pay');
    }
  }, [open, invoice]);

  // Update payment type based on amount
  useEffect(() => {
    const balanceDue = parseFloat(invoice.balance_due);
    const amountValue = parseFloat(amount);

    if (amountValue === balanceDue) {
      setPaymentType('full');
    } else if (amountValue < balanceDue && amountValue > 0) {
      setPaymentType('partial');
    }
  }, [amount, invoice.balance_due]);

  // Handle submit with proper validation and error handling
  const handleSubmit = async () => {
    setError('');

    // ✅ Frontend validation
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amountValidation = validateAmount(
      amount, 
      0.01, 
      parseFloat(invoice.balance_due)
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
      const result = await invoicesService.processPayment(invoice.id, {
        amount: amount,
        payment_method: selectedMethod.id,
        payment_type: paymentType,
        reference: referenceNumber || undefined,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
        idempotency_key: `${invoice.id}-${selectedMethod.id}-${amount}-${Date.now()}`,
        version: invoice.version,
      });

      showSnackbar(result.message || 'Payment processed successfully', 'success');
      
      onPaymentProcessed();
      onClose();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setError('Invoice was modified. Please refresh and try again.');
        showSnackbar('Invoice was modified by another user. Refreshing...', 'warning');
      } else {
        handleApiError(error, showSnackbar);
        setError(error?.response?.data?.error || 'Failed to process payment');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Calculate remaining balance after payment
  const remainingBalance = parseFloat(invoice.balance_due) - parseFloat(amount || '0');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography component="span" variant="h6">Process Payment</Typography>
          <Chip 
            label={invoice.invoice_number} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab value="pay" label="Payment" />
            <Tab value="recent" label="Recent Payments" />
          </Tabs>
        </Box>

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
                <Typography variant="body2">Amount Paid:</Typography>
                <Typography variant="body2">
                  {formatCurrency(invoice.amount_paid)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>
                  Balance Due:
                </Typography>
                <Typography variant="body2" fontWeight={700} color="error.main">
                  {formatCurrency(invoice.balance_due)}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {activeTab === 'pay' && (
          <TextField
            label="Payment Amount"
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
              max: parseFloat(invoice.balance_due),
              step: 0.01,
            }}
            helperText={`Maximum: ${formatCurrency(invoice.balance_due)}`}
          />
          )}

          {activeTab === 'pay' && (
          <FormControl component="fieldset">
            <Typography variant="subtitle2" gutterBottom>
              Payment Type
            </Typography>
            <RadioGroup
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
            >
              <FormControlLabel
                value="full"
                control={<Radio />}
                label="Full Payment"
                disabled={parseFloat(amount || '0') !== parseFloat(invoice.balance_due)}
              />
              <FormControlLabel
                value="partial"
                control={<Radio />}
                label="Partial Payment"
                disabled={parseFloat(amount || '0') === parseFloat(invoice.balance_due)}
              />
              <FormControlLabel 
                value="deposit" 
                control={<Radio />} 
                label="Deposit"
                disabled={invoice.payments.some(p => p.payment_type === 'deposit_application')}
              />
            </RadioGroup>
          </FormControl>
          )}

          {activeTab === 'pay' && (
          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={selectedMethod?.id || ''}
              onChange={(e) => {
                const method = paymentMethods.find((m) => m.id === e.target.value);
                setSelectedMethod(method || null);
                // Clear reference number when method changes
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
          )}

          {activeTab === 'pay' && selectedMethod?.requires_reference && (
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

          {activeTab === 'pay' && (
          <TextField
            label="Transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            fullWidth
            placeholder="Processor transaction ID (optional)"
            helperText="Optional: External transaction reference"
          />
          )}

          {activeTab === 'pay' && (
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Additional notes about this payment..."
          />
          )}

          {activeTab === 'pay' && invoice.payments.some(p => p.payment_type === 'deposit_application') && (
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, opacity: 0.1 }}>
              <Typography variant="subtitle2" color="info.dark" gutterBottom>
                Applied Deposits
              </Typography>
              <Stack spacing={1}>
                {invoice.payments
                  .filter(p => p.payment_type === 'deposit_application')
                  .map((deposit, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        Deposit Payment #{deposit.id}:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(deposit.amount)}
                      </Typography>
                    </Box>
                  ))}
                <Typography variant="body2" color="info.main" fontWeight={600}>
                  ✓ Deposits already applied to this invoice
                </Typography>
              </Stack>
            </Box>
          )}

          {activeTab === 'pay' && amount && parseFloat(amount) > 0 && (
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, opacity: 0.1 }}>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                Payment Preview
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Payment Amount:</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(amount)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Remaining Balance:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    color={remainingBalance > 0 ? 'error.main' : 'success.main'}
                  >
                    {formatCurrency(remainingBalance.toString())}
                  </Typography>
                </Box>
                {remainingBalance === 0 && (
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    ✓ Invoice will be marked as paid
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          {activeTab === 'recent' && (
            <Box sx={{ p: 2 }}>
              {invoice.payments.length === 0 ? (
                <Typography color="text.secondary">No payments yet.</Typography>
              ) : (
                <Stack spacing={1}>
                  {invoice.payments.slice(-5).reverse().map((p) => (
                    <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {dayjs(p.payment_date).format('MMM D, YYYY h:mm A')} • {p.payment_method_name || p.method}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color={'success.main'}>
                        +{formatCurrency(p.amount)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
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
          disabled={activeTab !== 'pay' || processing || !selectedMethod || !amount || parseFloat(amount) <= 0}
          startIcon={processing ? <CircularProgress size={20} /> : undefined}
        >
          {processing ? 'Processing...' : `Process Payment ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};
