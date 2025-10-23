import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { 
  CreditCard, 
  DollarSign, 
  Receipt, 
  CheckCircle,
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import { paymentMethodsService, PaymentMethod, invoicesService } from '../../services/invoices';
import { validateAmount, validateRequired } from '../../utils/validation';
import { handleApiError } from '../../utils/errorHandler';
import { useSnackbar } from '../common/useSnackbar';

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  reservationId: number;
  depositAmount: string;
  guestName: string;
  onRefundProcessed: () => void;
}

export const RefundDialog: React.FC<RefundDialogProps> = ({
  open,
  onClose,
  reservationId,
  depositAmount,
  guestName,
  onRefundProcessed
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [refundAmount, setRefundAmount] = useState(depositAmount);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load payment methods
  useEffect(() => {
    let mounted = true;
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
        setError('Failed to load payment methods');
      }
    };

    if (open) {
      loadPaymentMethods();
    }

    return () => {
      mounted = false;
    };
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setRefundAmount(depositAmount);
      setReferenceNumber('');
      setTransactionId('');
      setNotes('');
      setError('');
      setProcessing(false);
      setRetryCount(0);
    }
  }, [open, depositAmount]);

  // Handle submit
  const handleSubmit = async () => {
    setError('');

    // Frontend validation
    if (!selectedMethod) {
      setError('Please select a refund method');
      return;
    }

    const amountValidation = validateAmount(refundAmount, 0.01);
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
      // First, we need to get the invoice for this reservation
      const invoices = await invoicesService.list({ reservation: reservationId });
      const invoiceListItem = invoices.find(inv => inv.reservation === reservationId);
      
      if (!invoiceListItem) {
        throw new Error('No invoice found for this reservation');
      }

      // Get the full invoice details to get the current version
      const invoice = await invoicesService.retrieve(invoiceListItem.id);

      // Process the refund
      const refundResult = await invoicesService.refund(invoice.id, {
        amount: refundAmount,
        reason: 'Reservation cancellation - deposit refund',
        payment_method: selectedMethod.id.toString(),
        notes: notes || undefined,
        version: invoice.version,
      });

      showSnackbar(
        `Refund of $${refundAmount} processed successfully. Refund ID: ${refundResult.refund_id}`,
        'success'
      );
      
      onRefundProcessed();
      onClose();
    } catch (error: any) {
      console.error('Refund error:', error);
      
      // Handle specific error cases
      if (error?.response?.status === 409 && retryCount < 2) {
        // Retry with fresh invoice data
        setRetryCount(prev => prev + 1);
        setError(`Invoice was modified. Retrying... (${retryCount + 1}/2)`);
        
        // Wait a moment and retry
        setTimeout(() => {
          handleSubmit();
        }, 1000);
        return;
      } else if (error?.response?.status === 409) {
        setError('Invoice was modified by another user. Please refresh the page and try again.');
      } else if (error?.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error?.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to process refund. Please try again.');
      }
      
      handleApiError(error, showSnackbar);
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }
      }}
    >
      {SnackbarComponent}
      
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: 'white',
        fontWeight: 700,
        fontSize: '1.5rem'
      }}>
        Process Deposit Refund
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ 
              width: 48, 
              height: 48, 
              bgcolor: 'error.main', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}>
              <TrendingDown size={24} color="white" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                Refund Deposit for {guestName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reservation #{reservationId} - Deposit Amount: {formatCurrency(depositAmount)}
              </Typography>
            </Box>
          </Box>
          <Divider />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Refund Information */}
        <Card sx={{ mb: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AlertCircle size={18} color="#dc2626" />
              <Typography variant="subtitle2" fontWeight={600} color="#dc2626">
                Refund Required
              </Typography>
            </Box>
            <Typography variant="body2" color="#991b1b">
              This reservation has a prepaid deposit that needs to be refunded due to cancellation.
            </Typography>
          </CardContent>
        </Card>

        {/* Refund Form */}
        <Grid container spacing={3}>
          {/* Refund Method */}
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Refund Method</InputLabel>
              <Select
                value={selectedMethod?.id || ''}
                onChange={(e) => {
                  const method = paymentMethods.find(m => m.id === e.target.value);
                  setSelectedMethod(method || null);
                  setReferenceNumber(''); // Reset reference when method changes
                }}
                label="Refund Method"
              >
                {paymentMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{method.name}</Typography>
                      {method.requires_reference && (
                        <Chip 
                          label="Ref Required" 
                          size="small" 
                          color="warning" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Refund Amount */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Refund Amount"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              type="number"
              inputProps={{ min: 0.01, step: 0.01, max: parseFloat(depositAmount) }}
              InputProps={{
                startAdornment: <DollarSign size={20} style={{ marginRight: 8, color: '#666' }} />
              }}
              helperText={`Maximum refundable amount: ${formatCurrency(depositAmount)}`}
              required
            />
          </Grid>

          {/* Reference Number (conditional) */}
          {selectedMethod?.requires_reference && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reference Number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                helperText="Enter transaction ID or reference number"
                required
              />
            </Grid>
          )}

          {/* Transaction ID */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Transaction ID (Optional)"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              helperText="Optional: Payment gateway transaction ID"
            />
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Refund Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              placeholder="Reason for refund or additional notes..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          variant="outlined" 
          onClick={onClose} 
          disabled={processing}
          sx={{ borderRadius: 2 }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={processing || !selectedMethod || parseFloat(refundAmount) <= 0}
          startIcon={processing ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle />}
          sx={{ 
            borderRadius: 2,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            }
          }}
        >
          {processing ? 'Processing...' : `Process Refund ${formatCurrency(refundAmount || '0')}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
