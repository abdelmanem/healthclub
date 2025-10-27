/**
 * PaymentDialog Component
 * 
 * Enhanced modal dialog for processing payments with improved visual design
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
  Paper,
  Divider,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { invoicesService, paymentMethodsService, Invoice, PaymentMethod } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount, validateRequired } from '../../utils/validation';
import dayjs from 'dayjs';

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

  const handleSubmit = async () => {
    setError('');

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

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const remainingBalance = parseFloat(invoice.balance_due) - parseFloat(amount || '0');

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <PaymentIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={600}>Process Payment</Typography>
              <Typography variant="caption" color="text.secondary">
                Invoice {invoice.invoice_number}
              </Typography>
            </Box>
          </Stack>
          <Chip 
            label={invoice.status} 
            size="small" 
            color={invoice.status === 'paid' ? 'success' : 'warning'}
            sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}
          />
        </Stack>
      </DialogTitle>
      
      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)}
          sx={{ 
            mb: 3,
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.95rem',
            }
          }}
        >
          <Tab value="pay" label="Make Payment" icon={<MoneyIcon />} iconPosition="start" />
          <Tab value="recent" label="Payment History" icon={<InfoIcon />} iconPosition="start" />
        </Tabs>

        <Stack spacing={3}>
          {/* Invoice Summary Card */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.100',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" color="primary.main" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
              INVOICE SUMMARY
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatCurrency(invoice.total)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
                <Typography variant="body1" fontWeight={500} color="success.main">
                  {formatCurrency(invoice.amount_paid)}
                </Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" fontWeight={700}>Balance Due</Typography>
                <Typography variant="h5" fontWeight={700} color="error.main">
                  {formatCurrency(invoice.balance_due)}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Fade in>
              <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
            </Fade>
          )}

          {activeTab === 'pay' && (
            <Fade in>
              <Stack spacing={3}>
                <TextField
                  label="Payment Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MoneyIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{
                    min: 0.01,
                    max: parseFloat(invoice.balance_due),
                    step: 0.01,
                  }}
                  helperText={`Maximum: ${formatCurrency(invoice.balance_due)}`}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />

                <FormControl component="fieldset">
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                    Payment Type
                  </Typography>
                  <RadioGroup
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                  >
                    <Paper elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <FormControlLabel
                        value="full"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>Full Payment</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pay the entire balance
                            </Typography>
                          </Box>
                        }
                        disabled={parseFloat(amount || '0') !== parseFloat(invoice.balance_due)}
                      />
                    </Paper>
                    <Paper elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <FormControlLabel
                        value="partial"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>Partial Payment</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pay a portion of the balance
                            </Typography>
                          </Box>
                        }
                        disabled={parseFloat(amount || '0') === parseFloat(invoice.balance_due)}
                      />
                    </Paper>
                    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <FormControlLabel 
                        value="deposit" 
                        control={<Radio />} 
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>Deposit</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Apply as a deposit payment
                            </Typography>
                          </Box>
                        }
                        disabled={invoice.payments.some(p => p.payment_type === 'deposit_application')}
                      />
                    </Paper>
                  </RadioGroup>
                </FormControl>

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
                    sx={{ borderRadius: 2 }}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.id} value={method.id}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {method.icon && <span style={{ fontSize: '1.2rem' }}>{method.icon}</span>}
                          <Typography fontWeight={500}>{method.name}</Typography>
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

                {selectedMethod?.requires_reference && (
                  <Zoom in>
                    <TextField
                      label="Reference Number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      fullWidth
                      required
                      placeholder="Last 4 digits, check number, etc."
                      helperText={`Required for ${selectedMethod.name} payments`}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Zoom>
                )}

                <TextField
                  label="Transaction ID (Optional)"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  fullWidth
                  placeholder="External transaction reference"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  label="Notes (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add any additional notes about this payment..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                {invoice.payments.some(p => p.payment_type === 'deposit_application') && (
                  <Paper 
                    elevation={0}
                    sx={{ 
                      p: 2.5, 
                      bgcolor: 'info.50', 
                      border: '1px solid',
                      borderColor: 'info.200',
                      borderRadius: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <InfoIcon color="info" fontSize="small" />
                      <Typography variant="subtitle2" color="info.main" fontWeight={700}>
                        APPLIED DEPOSITS
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {invoice.payments
                        .filter(p => p.payment_type === 'deposit_application')
                        .map((deposit, index) => (
                          <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              Deposit Payment #{deposit.id}
                            </Typography>
                            <Typography variant="body2" fontWeight={600} color="info.main">
                              {formatCurrency(deposit.amount)}
                            </Typography>
                          </Box>
                        ))}
                    </Stack>
                  </Paper>
                )}

                {amount && parseFloat(amount) > 0 && (
                  <Zoom in>
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'success.50', 
                        border: '2px solid',
                        borderColor: 'success.200',
                        borderRadius: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <CheckCircleIcon color="success" />
                        <Typography variant="subtitle2" color="success.main" fontWeight={700}>
                          PAYMENT PREVIEW
                        </Typography>
                      </Stack>
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">Payment Amount</Typography>
                          <Typography variant="h6" fontWeight={700} color="success.main">
                            {formatCurrency(amount)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">Remaining Balance</Typography>
                          <Typography 
                            variant="h6" 
                            fontWeight={700}
                            color={remainingBalance > 0 ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(remainingBalance.toString())}
                          </Typography>
                        </Box>
                        {remainingBalance === 0 && (
                          <Alert 
                            severity="success" 
                            icon={<CheckCircleIcon />}
                            sx={{ 
                              mt: 1,
                              borderRadius: 1.5,
                              fontWeight: 600,
                            }}
                          >
                            Invoice will be marked as fully paid
                          </Alert>
                        )}
                      </Stack>
                    </Paper>
                  </Zoom>
                )}
              </Stack>
            </Fade>
          )}

          {activeTab === 'recent' && (
            <Fade in>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  minHeight: 200,
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
                  RECENT PAYMENTS
                </Typography>
                {invoice.payments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PaymentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary">No payments recorded yet</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {invoice.payments.slice(-5).reverse().map((p) => (
                      <Paper 
                        key={p.id} 
                        elevation={0}
                        sx={{ 
                          p: 2, 
                          bgcolor: 'grey.50',
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {p.payment_method_name || p.method}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(p.payment_date).format('MMM D, YYYY • h:mm A')}
                            </Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={700} color="success.main">
                            {formatCurrency(p.amount)}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Fade>
          )}
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={processing}
          size="large"
          sx={{ 
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={activeTab !== 'pay' || processing || !selectedMethod || !amount || parseFloat(amount) <= 0}
          startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
          size="large"
          sx={{ 
            textTransform: 'none',
            fontWeight: 600,
            px: 4,
            borderRadius: 2,
            boxShadow: 2,
          }}
        >
          {processing ? 'Processing...' : `Process ${formatCurrency(amount || '0')}`}
        </Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};