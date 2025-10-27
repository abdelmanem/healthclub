/**
 * Applied Discounts Manager
 * 
 * View and manage applied discounts including:
 * - Filter by status, date, employee
 * - Approve/reject pending discounts
 * - Cancel applied discounts
 * - View discount history
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
  Pagination,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../common/useSnackbar';
import { discountService, ReservationDiscount } from '../../services/discounts';

interface AppliedDiscountsManagerProps {
  onRefresh: () => void;
}

export const AppliedDiscountsManager: React.FC<AppliedDiscountsManagerProps> = ({ onRefresh }) => {
  const [discounts, setDiscounts] = useState<ReservationDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    applied_by: '',
  });
  const [selectedDiscount, setSelectedDiscount] = useState<ReservationDiscount | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'cancel'>('approve');
  const [actionReason, setActionReason] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load applied discounts
  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        ...filters,
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') {
          delete params[key];
        }
      });

      const data = await discountService.listReservationDiscounts(params);
      setDiscounts(data);
      setTotalPages(Math.ceil(data.length / 10)); // Assuming 10 items per page
    } catch (error) {
      console.error('Failed to load applied discounts:', error);
      showSnackbar('Failed to load applied discounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, [page, filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters({ ...filters, [field]: value });
    setPage(1); // Reset to first page when filtering
  };

  const handleViewDetails = (discount: ReservationDiscount) => {
    setSelectedDiscount(discount);
    setDetailDialogOpen(true);
  };

  const handleAction = (discount: ReservationDiscount, action: 'approve' | 'reject' | 'cancel') => {
    setSelectedDiscount(discount);
    setActionType(action);
    setActionReason('');
    setActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedDiscount) return;

    try {
      switch (actionType) {
        case 'approve':
          await discountService.approveReservationDiscount(selectedDiscount.id, actionReason);
          showSnackbar('Discount approved successfully', 'success');
          break;
        case 'reject':
          await discountService.rejectReservationDiscount(selectedDiscount.id, actionReason);
          showSnackbar('Discount rejected successfully', 'success');
          break;
        case 'cancel':
          await discountService.cancelReservationDiscount(selectedDiscount.id, actionReason);
          showSnackbar('Discount cancelled successfully', 'success');
          break;
      }
      
      setActionDialogOpen(false);
      setSelectedDiscount(null);
      loadDiscounts();
      onRefresh();
    } catch (error: any) {
      console.error(`Failed to ${actionType} discount:`, error);
      showSnackbar(`Failed to ${actionType} discount: ${error.response?.data?.detail || error.message}`, 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'success';
      case 'approved':
        return 'info';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied':
      case 'approved':
        return <CheckCircleIcon />;
      case 'rejected':
      case 'cancelled':
        return <CancelIcon />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number | string) => {
    return `$${Number(amount).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      {/* Header and Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Applied Discounts ({discounts.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadDiscounts} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                placeholder="Search by guest name, discount type..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="applied">Applied</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Applied By</InputLabel>
                <Select
                  value={filters.applied_by}
                  onChange={(e) => handleFilterChange('applied_by', e.target.value)}
                >
                  <MenuItem value="">All Users</MenuItem>
                  {/* This would be populated from a users API */}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setFilters({ status: '', search: '', applied_by: '' })}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Discounts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Guest</TableCell>
              <TableCell>Discount Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Applied By</TableCell>
              <TableCell>Applied At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No discounts found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {discount.reservation_guest_name || 'Unknown Guest'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reservation #{discount.reservation}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {discount.discount_type.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {discount.discount_type.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        Original: {formatCurrency(discount.original_amount)}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        Discount: -{formatCurrency(discount.discount_amount)}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        Final: {formatCurrency(discount.final_amount)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(discount.status) || undefined}
                      label={discount.status.toUpperCase()}
                      color={getStatusColor(discount.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {discount.applied_by_name || 'Unknown User'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(discount.applied_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewDetails(discount)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      
                      {discount.status === 'pending' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handleAction(discount, 'approve')}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleAction(discount, 'reject')}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      
                      {(discount.status === 'applied' || discount.status === 'approved') && (
                        <Tooltip title="Cancel">
                          <IconButton 
                            size="small" 
                            color="warning"
                            onClick={() => handleAction(discount, 'cancel')}
                          >
                            <CancelIcon />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Discount Details</DialogTitle>
        <DialogContent>
          {selectedDiscount && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Guest</Typography>
                <Typography variant="body1">{selectedDiscount.reservation_guest_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Reservation</Typography>
                <Typography variant="body1">#{selectedDiscount.reservation}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Discount Type</Typography>
                <Typography variant="body1">{selectedDiscount.discount_type.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip
                  icon={getStatusIcon(selectedDiscount.status) || undefined}
                  label={selectedDiscount.status.toUpperCase()}
                  color={getStatusColor(selectedDiscount.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Original Amount</Typography>
                <Typography variant="body1">{formatCurrency(selectedDiscount.original_amount)}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Discount Amount</Typography>
                <Typography variant="body1" color="success.main">
                  -{formatCurrency(selectedDiscount.discount_amount)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Final Amount</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatCurrency(selectedDiscount.final_amount)}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                <Typography variant="body1">{selectedDiscount.reason || 'No reason provided'}</Typography>
              </Grid>
              {selectedDiscount.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                  <Typography variant="body1">{selectedDiscount.notes}</Typography>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Applied By</Typography>
                <Typography variant="body1">{selectedDiscount.applied_by_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Applied At</Typography>
                <Typography variant="body1">{formatDate(selectedDiscount.applied_at)}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialogOpen} 
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionType === 'approve' ? 'Approve Discount' : 
           actionType === 'reject' ? 'Reject Discount' : 'Cancel Discount'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={actionType === 'approve' ? 'Approval Notes' : 
                   actionType === 'reject' ? 'Rejection Reason' : 'Cancellation Reason'}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            sx={{ mt: 2 }}
            required={actionType !== 'approve'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmAction} 
            variant="contained"
            color={actionType === 'approve' ? 'success' : actionType === 'reject' ? 'error' : 'warning'}
            disabled={actionType !== 'approve' && !actionReason.trim()}
          >
            {actionType === 'approve' ? 'Approve' : 
             actionType === 'reject' ? 'Reject' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      {SnackbarComponent}
    </Box>
  );
};
