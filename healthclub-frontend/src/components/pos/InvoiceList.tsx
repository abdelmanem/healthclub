/**
 * InvoiceList Component
 * 
 * Displays list of invoices with filtering, searching, and actions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  IconButton,
  Stack,
  InputAdornment,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Add,
  Visibility,
  Payment,
  Receipt,
  FilterList,
} from '@mui/icons-material';
import { invoicesService, InvoiceListItem } from '../../services/invoices';
import dayjs from 'dayjs';

interface InvoiceListProps {
  guestId?: number;
  reservationId?: number;
  status?: string;
  onInvoiceClick?: (invoice: InvoiceListItem) => void;
  onCreateClick?: () => void;
  onPaymentClick?: (invoice: InvoiceListItem) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  guestId,
  reservationId,
  status,
  onInvoiceClick,
  onCreateClick,
  onPaymentClick,
}) => {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(status || '');
  const [dateFilter, setDateFilter] = useState<{
    start?: string;
    end?: string;
  }>({});

  // Load invoices
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await invoicesService.list({
        guest: guestId,
        reservation: reservationId,
        status: statusFilter || undefined,
        start_date: dateFilter.start,
        end_date: dateFilter.end,
        search: search || undefined,
      });
      setInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [guestId, reservationId, statusFilter, dateFilter, status]);

  // Update status filter when status prop changes
  useEffect(() => {
    if (status) {
      setStatusFilter(status);
    }
  }, [status]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        loadInvoices();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Status color mapping
  const getStatusColor = (status: InvoiceListItem['status']) => {
    const colors = {
      draft: 'default',
      pending: 'warning',
      issued: 'info',
      partial: 'info',
      paid: 'success',
      overdue: 'error',
      cancelled: 'default',
      refunded: 'secondary',
    };
    return colors[status] || 'default';
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Calculate totals
  const totals = invoices.reduce(
    (acc, invoice) => ({
      total: acc.total + parseFloat(invoice.total),
      paid: acc.paid + parseFloat(invoice.amount_paid),
      outstanding: acc.outstanding + parseFloat(invoice.balance_due),
    }),
    { total: 0, paid: 0, outstanding: 0 }
  );

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">Invoices</Typography>
          {onCreateClick && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={onCreateClick}
            >
              Create Invoice
            </Button>
          )}
        </Box>

        {/* Filters */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Search"
            placeholder="Invoice #, guest name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="issued">Issued</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="refunded">Refunded</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Start Date"
            type="date"
            value={dateFilter.start || ''}
            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="End Date"
            type="date"
            value={dateFilter.end || ''}
            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Guest</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        No invoices found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onInvoiceClick?.(invoice)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {invoice.invoice_number}
                        </Typography>
                      </TableCell>
                      <TableCell>{invoice.guest_name}</TableCell>
                      <TableCell>
                        {dayjs(invoice.date).format('MMM D, YYYY')}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(invoice.total)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(invoice.amount_paid)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight={600}
                          color={
                            parseFloat(invoice.balance_due) > 0
                              ? 'error.main'
                              : 'text.primary'
                          }
                        >
                          {formatCurrency(invoice.balance_due)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status}
                          color={getStatusColor(invoice.status) as any}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceClick?.(invoice);
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {parseFloat(invoice.balance_due) > 0 && (
                            <Tooltip title="Process Payment">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPaymentClick?.(invoice);
                                }}
                              >
                                <Payment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Summary */}
        {invoices.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Total Invoices: <strong>{invoices.length}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Amount: <strong>{formatCurrency(totals.total.toString())}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Paid: <strong>{formatCurrency(totals.paid.toString())}</strong>
            </Typography>
            <Typography variant="body2" color="error">
              Outstanding: <strong>{formatCurrency(totals.outstanding.toString())}</strong>
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
