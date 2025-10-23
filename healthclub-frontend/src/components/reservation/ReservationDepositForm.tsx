import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Alert, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Grid,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import { 
  CreditCard, 
  DollarSign, 
  Receipt, 
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import { paymentMethodsService, PaymentMethod } from '../../services/invoices';
import { reservationsService } from '../../services/reservations';
import { validateAmount, validateRequired } from '../../utils/validation';
import { handleApiError } from '../../utils/errorHandler';
import { useSnackbar } from '../common/useSnackbar';

interface ReservationDepositFormProps {
  reservationId: number;
  depositAmount: string;
  guestName: string;
  onDepositCollected: () => void;
  onClose: () => void;
}

export const ReservationDepositForm: React.FC<ReservationDepositFormProps> = ({
  reservationId,
  depositAmount,
  guestName,
  onDepositCollected,
  onClose,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(depositAmount);
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

    loadPaymentMethods();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
      const result = await reservationsService.payDeposit(reservationId, {
        amount: amount,
        payment_method: selectedMethod.id,
        reference: referenceNumber || undefined,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
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

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <Box>
      {SnackbarComponent}
      
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ 
            width: 48, 
            height: 48, 
            borderRadius: 2, 
            bgcolor: 'primary.main', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <CreditCard size={24} color="white" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Collect Deposit Payment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              For {guestName}
            </Typography>
          </Box>
        </Box>
        
        <Card sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircle size={20} color="var(--mui-palette-success-main)" />
              <Typography variant="body2" fontWeight={500} color="success.main">
                Required Deposit: {formatCurrency(depositAmount)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Payment Form */}
      <Grid container spacing={3}>
        {/* Payment Method */}
        <Grid item xs={12}>
          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={selectedMethod?.id || ''}
              onChange={(e) => {
                const method = paymentMethods.find(m => m.id === e.target.value);
                setSelectedMethod(method || null);
                setReferenceNumber(''); // Reset reference when method changes
              }}
              label="Payment Method"
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

        {/* Amount */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Deposit Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            inputProps={{ min: 0.01, step: 0.01 }}
            InputProps={{
              startAdornment: <DollarSign size={20} style={{ marginRight: 8, color: '#666' }} />
            }}
            helperText="Enter the deposit amount to collect"
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
              placeholder="Enter reference number"
              required
              helperText={`Reference number required for ${selectedMethod.name}`}
            />
          </Grid>
        )}

        {/* Transaction ID (optional) */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Transaction ID (Optional)"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Enter transaction ID if available"
            helperText="Optional transaction reference"
          />
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            placeholder="Add any additional notes..."
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={processing}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={processing || !selectedMethod || !amount}
          startIcon={<Receipt size={20} />}
          sx={{ minWidth: 140 }}
        >
          {processing ? 'Processing...' : 'Collect Deposit'}
        </Button>
      </Box>
    </Box>
  );
};
