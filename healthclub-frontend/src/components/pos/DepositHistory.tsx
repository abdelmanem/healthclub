/**
 * DepositHistory Component
 * 
 * Shows deposit history for an invoice's guest
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  IconButton,
  Tooltip,
  Collapse,
  Button,
  Grid,
} from '@mui/material';
import {
  AccountBalance,
  ExpandMore,
  ExpandLess,
  Payment,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { depositsService, Deposit } from '../../services/invoices';
import { useSnackbar } from '../common/useSnackbar';
import { handleApiError } from '../../utils/errorHandler';
import { useCurrencyFormatter } from '../../utils/currency';
import dayjs from 'dayjs';

interface DepositHistoryProps {
  invoiceId: number;
  guestName: string;
  onDepositUpdated?: () => void;
}

interface AvailableDepositsData {
  invoice_id: number;
  guest_name: string;
  available_deposits_count: number;
  total_available_amount: string;
  deposits: Deposit[];
}

export const DepositHistory: React.FC<DepositHistoryProps> = ({
  invoiceId,
  guestName,
  onDepositUpdated,
}) => {
  const [availableDeposits, setAvailableDeposits] = useState<AvailableDepositsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { formatCurrency } = useCurrencyFormatter();

  // Load available deposits
  const loadAvailableDeposits = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await depositsService.getAvailableForInvoice(invoiceId);
      setAvailableDeposits(data);
    } catch (error: any) {
      console.error('Failed to load deposit history:', error);
      setError('Failed to load deposit history');
      handleApiError(error, showSnackbar);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableDeposits();
  }, [invoiceId]);

  // Refresh when deposits are updated
  useEffect(() => {
    if (onDepositUpdated) {
      loadAvailableDeposits();
    }
  }, [onDepositUpdated]);


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

  // Get payment method icon
  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'credit_card':
      case 'debit_card':
        return '💳';
      case 'cash':
        return '💵';
      case 'check':
        return '📝';
      case 'bank_transfer':
        return '🏦';
      default:
        return '💰';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" py={2}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading deposit history...
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

  if (!availableDeposits || availableDeposits.deposits.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" py={2}>
            <AccountBalance color="disabled" sx={{ mr: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No deposit history found for {guestName}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Group deposits by status for better organization
  const depositsByStatus = availableDeposits.deposits.reduce((acc, deposit) => {
    if (!acc[deposit.status]) {
      acc[deposit.status] = [];
    }
    acc[deposit.status].push(deposit);
    return acc;
  }, {} as Record<string, Deposit[]>);

  const totalDeposits = availableDeposits.deposits.length;
  const totalAmount = availableDeposits.deposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);
  const totalApplied = availableDeposits.deposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount_applied), 0);
  const totalRemaining = availableDeposits.deposits.reduce((sum, deposit) => sum + parseFloat(deposit.remaining_amount), 0);

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AccountBalance color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">
              Deposit History
            </Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <Chip
              label={`${totalDeposits} deposits`}
              color="primary"
              variant="outlined"
              sx={{ mr: 1 }}
            />
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Summary */}
        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total Deposits
              </Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(totalAmount.toString())}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Applied
              </Typography>
              <Typography variant="h6" color="info.main">
                {formatCurrency(totalApplied.toString())}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Available
              </Typography>
              <Typography variant="h6" color="success.main">
                {formatCurrency(totalRemaining.toString())}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Count
              </Typography>
              <Typography variant="h6">
                {totalDeposits}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Collapsible Details */}
        <Collapse in={expanded}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Applied</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Collected</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableDeposits.deposits
                  .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())
                  .map((deposit) => (
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
                      <Box display="flex" alignItems="center">
                        <Typography sx={{ mr: 1 }}>
                          {getPaymentMethodIcon(deposit.payment_method)}
                        </Typography>
                        <Typography variant="body2">
                          {deposit.payment_method}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(deposit.collected_at).format('MMM D, YYYY')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {dayjs(deposit.collected_at).format('h:mm A')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {deposit.notes ? (
                        <Tooltip title={deposit.notes}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {deposit.notes.length > 20 
                              ? `${deposit.notes.substring(0, 20)}...` 
                              : deposit.notes
                            }
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          No notes
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>

        {/* Status Breakdown */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Status Breakdown
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {Object.entries(depositsByStatus).map(([status, deposits]) => (
              <Chip
                key={status}
                icon={getStatusIcon(status)}
                label={`${status} (${deposits.length})`}
                color={getStatusColor(status) as any}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};
