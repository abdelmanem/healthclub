/**
 * DepositManagement Component
 * 
 * Manages deposits for invoices - shows available deposits and allows applying them
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Grid,
} from '@mui/material';
import {
  AccountBalance,
  Payment,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { depositsService, Deposit } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { validateAmount } from '../../utils/validation';
import dayjs from 'dayjs';

interface DepositManagementProps {
  invoiceId: number;
  guestName: string;
  onDepositApplied?: () => void;
}

interface AvailableDepositsData {
  invoice_id: number;
  guest_name: string;
  available_deposits_count: number;
  total_available_amount: string;
  deposits: Deposit[];
}

export const DepositManagement: React.FC<DepositManagementProps> = ({
  invoiceId,
  guestName,
  onDepositApplied,
}) => {
  const [availableDeposits, setAvailableDeposits] = useState<AvailableDepositsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [applyAmount, setApplyAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load available deposits
  const loadAvailableDeposits = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await depositsService.getAvailableForInvoice(invoiceId);
      setAvailableDeposits(data);
    } catch (error: any) {
      console.error('Failed to load available deposits:', error);
      setError('Failed to load available deposits');
      handleApiError(error, showSnackbar);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableDeposits();
  }, [invoiceId]);

  // Handle applying deposit
  const handleApplyDeposit = async () => {
    if (!selectedDeposit) return;

    setError('');
    
    // Validate amount
    const amountValidation = validateAmount(
      applyAmount,
      0.01,
      parseFloat(selectedDeposit.remaining_amount)
    );
    
    if (!amountValidation.valid) {
      setError(amountValidation.error!);
      return;
    }

    setApplying(true);

    try {
      const result = await depositsService.applyToInvoice(invoiceId, {
        deposit_id: selectedDeposit.id,
        amount: applyAmount,
      });

      showSnackbar(result.message || 'Deposit applied successfully', 'success');
      
      setApplyDialogOpen(false);
      setSelectedDeposit(null);
      setApplyAmount('');
      
      // Reload deposits and notify parent
      await loadAvailableDeposits();
      onDepositApplied?.();
    } catch (error: any) {
      setError(error?.response?.data?.error || 'Failed to apply deposit');
      handleApiError(error, showSnackbar);
    } finally {
      setApplying(false);
    }
  };

  // Open apply dialog
  const openApplyDialog = (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    setApplyAmount(deposit.remaining_amount);
    setApplyDialogOpen(true);
    setError('');
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'applied': return 'info';
      case 'refunded': return 'error';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle />;
      case 'applied': return <Payment />;
      case 'refunded': return <Warning />;
      default: return <Info />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading available deposits...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={loadAvailableDeposits}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!availableDeposits || availableDeposits.available_deposits_count === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" py={2}>
            <AccountBalance color="disabled" sx={{ mr: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No available deposits found for {guestName}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <AccountBalance color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">
                Available Deposits
              </Typography>
            </Box>
            <Chip
              label={`${availableDeposits.available_deposits_count} deposits`}
              color="primary"
              variant="outlined"
            />
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Total Available:</strong> {formatCurrency(availableDeposits.total_available_amount)}
            </Typography>
            <Typography variant="caption" display="block">
              Deposits can be applied to reduce the invoice balance
            </Typography>
          </Alert>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Deposit ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Applied</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Collected</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableDeposits.deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        #{deposit.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(deposit.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(deposit.amount_applied)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="primary">
                        {formatCurrency(deposit.remaining_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(deposit.status)}
                        label={deposit.status_display}
                        color={getStatusColor(deposit.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(deposit.collected_at).format('MMM D, YYYY')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => openApplyDialog(deposit)}
                        disabled={!deposit.can_be_applied}
                        startIcon={<Payment />}
                      >
                        Apply
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Apply Deposit Dialog */}
      <Dialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Apply Deposit to Invoice
        </DialogTitle>
        <DialogContent>
          {selectedDeposit && (
            <Stack spacing={3}>
              {/* Deposit Info */}
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Deposit Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Deposit ID:</strong> #{selectedDeposit.id}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Original Amount:</strong> {formatCurrency(selectedDeposit.amount)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Already Applied:</strong> {formatCurrency(selectedDeposit.amount_applied)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="primary">
                      <strong>Available:</strong> {formatCurrency(selectedDeposit.remaining_amount)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Amount Input */}
              <TextField
                fullWidth
                label="Amount to Apply"
                value={applyAmount}
                onChange={(e) => setApplyAmount(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                helperText={`Maximum: ${formatCurrency(selectedDeposit.remaining_amount)}`}
                error={!!error}
              />

              {/* Error Display */}
              {error && (
                <Alert severity="error">
                  {error}
                </Alert>
              )}

              {/* Preview */}
              <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="success.contrastText" gutterBottom>
                  Application Preview
                </Typography>
                <Typography variant="body2" color="success.contrastText">
                  Applying {formatCurrency(applyAmount || '0')} from Deposit #{selectedDeposit.id}
                </Typography>
                <Typography variant="caption" color="success.contrastText" display="block">
                  Remaining deposit balance: {formatCurrency(
                    (parseFloat(selectedDeposit.remaining_amount) - parseFloat(applyAmount || '0')).toString()
                  )}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialogOpen(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleApplyDeposit}
            disabled={(() => {
              if (applying) return true;
              if (!selectedDeposit) return true;
              const amt = parseFloat(applyAmount || '');
              if (isNaN(amt)) return true;
              if (amt <= 0) return true;
              const max = parseFloat(selectedDeposit.remaining_amount);
              if (amt > max) return true;
              return false;
            })()}
            startIcon={applying ? <CircularProgress size={20} /> : <Payment />}
          >
            {applying ? 'Applying...' : `Apply ${formatCurrency(applyAmount || '0')}`}
          </Button>
        </DialogActions>
      </Dialog>

      {SnackbarComponent}
    </>
  );
};
