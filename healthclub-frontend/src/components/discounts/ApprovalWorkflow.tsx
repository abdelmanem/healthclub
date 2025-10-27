/**
 * Approval Workflow
 * 
 * Manager interface for approving discounts including:
 * - Pending discounts queue
 * - Approval/rejection with reasons
 * - Bulk approval operations
 * - Notification system
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  SelectAll as SelectAllIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../common/useSnackbar';
import { discountService, ReservationDiscount } from '../../services/discounts';

interface ApprovalWorkflowProps {
  onRefresh: () => void;
}

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({ onRefresh }) => {
  const [pendingDiscounts, setPendingDiscounts] = useState<ReservationDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiscounts, setSelectedDiscounts] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<ReservationDiscount | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load pending discounts
  const loadPendingDiscounts = async () => {
    setLoading(true);
    try {
      const data = await discountService.listReservationDiscounts({ status: 'pending' });
      setPendingDiscounts(data);
    } catch (error) {
      console.error('Failed to load pending discounts:', error);
      showSnackbar('Failed to load pending discounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDiscounts();
  }, []);

  const handleSelectDiscount = (discountId: number) => {
    setSelectedDiscounts(prev => 
      prev.includes(discountId) 
        ? prev.filter(id => id !== discountId)
        : [...prev, discountId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDiscounts.length === pendingDiscounts.length) {
      setSelectedDiscounts([]);
    } else {
      setSelectedDiscounts(pendingDiscounts.map(d => d.id));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (selectedDiscounts.length === 0) {
      showSnackbar('Please select at least one discount', 'warning');
      return;
    }
    setBulkAction(action);
    setBulkReason('');
    setBulkDialogOpen(true);
  };

  const handleConfirmBulkAction = async () => {
    if (!bulkAction || selectedDiscounts.length === 0) return;

    try {
      const promises = selectedDiscounts.map(discountId => {
        if (bulkAction === 'approve') {
          return discountService.approveReservationDiscount(discountId, bulkReason);
        } else {
          return discountService.rejectReservationDiscount(discountId, bulkReason);
        }
      });

      await Promise.all(promises);
      
      showSnackbar(
        `${bulkAction === 'approve' ? 'Approved' : 'Rejected'} ${selectedDiscounts.length} discount(s) successfully`,
        'success'
      );
      
      setBulkDialogOpen(false);
      setSelectedDiscounts([]);
      loadPendingDiscounts();
      onRefresh();
    } catch (error: any) {
      console.error(`Failed to ${bulkAction} discounts:`, error);
      showSnackbar(`Failed to ${bulkAction} discounts: ${error.response?.data?.detail || error.message}`, 'error');
    }
  };

  const handleSingleAction = async (discount: ReservationDiscount, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await discountService.approveReservationDiscount(discount.id, 'Approved via workflow');
      } else {
        await discountService.rejectReservationDiscount(discount.id, 'Rejected via workflow');
      }
      
      showSnackbar(`Discount ${action === 'approve' ? 'approved' : 'rejected'} successfully`, 'success');
      loadPendingDiscounts();
      onRefresh();
    } catch (error: any) {
      console.error(`Failed to ${action} discount:`, error);
      showSnackbar(`Failed to ${action} discount: ${error.response?.data?.detail || error.message}`, 'error');
    }
  };

  const handleViewDetails = (discount: ReservationDiscount) => {
    setSelectedDiscount(discount);
    setDetailDialogOpen(true);
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

  const getDiscountTypeColor = (discountType: any) => {
    switch (discountType.discount_method) {
      case 'percentage':
        return 'primary';
      case 'fixed_amount':
        return 'secondary';
      case 'free_service':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Pending Approvals ({pendingDiscounts.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadPendingDiscounts} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Bulk Actions */}
      {pendingDiscounts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedDiscounts.length === pendingDiscounts.length}
                    indeterminate={selectedDiscounts.length > 0 && selectedDiscounts.length < pendingDiscounts.length}
                    onChange={handleSelectAll}
                  />
                }
                label={`Select All (${selectedDiscounts.length}/${pendingDiscounts.length})`}
              />
              <Divider orientation="vertical" flexItem />
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleBulkAction('approve')}
                disabled={selectedDiscounts.length === 0}
              >
                Approve Selected ({selectedDiscounts.length})
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => handleBulkAction('reject')}
                disabled={selectedDiscounts.length === 0}
              >
                Reject Selected ({selectedDiscounts.length})
              </Button>
              {selectedDiscounts.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={() => setSelectedDiscounts([])}
                >
                  Clear Selection
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Pending Discounts */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : pendingDiscounts.length === 0 ? (
        <Alert severity="info">
          No pending discounts to approve
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {pendingDiscounts.map((discount) => (
            <Grid item xs={12} md={6} lg={4} key={discount.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Checkbox
                      checked={selectedDiscounts.includes(discount.id)}
                      onChange={() => handleSelectDiscount(discount.id)}
                    />
                    <Chip
                      label={discount.discount_type.discount_method.replace('_', ' ').toUpperCase()}
                      color={getDiscountTypeColor(discount.discount_type)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    {discount.discount_type.name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {discount.discount_type.description}
                  </Typography>
                  
                  <Stack spacing={1} sx={{ my: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Guest:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {discount.reservation_guest_name || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Reservation:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        #{discount.reservation}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Original Amount:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(discount.original_amount)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Discount:</Typography>
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        -{formatCurrency(discount.discount_amount)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Final Amount:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(discount.final_amount)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Applied By:</Typography>
                      <Typography variant="body2">
                        {discount.applied_by_name || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Applied At:</Typography>
                      <Typography variant="body2">
                        {formatDate(discount.applied_at)}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {discount.reason && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Reason:</strong> {discount.reason}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => handleViewDetails(discount)}
                  >
                    View Details
                  </Button>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleSingleAction(discount, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => handleSingleAction(discount, 'reject')}
                    >
                      Reject
                    </Button>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Bulk Action Dialog */}
      <Dialog 
        open={bulkDialogOpen} 
        onClose={() => setBulkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {bulkAction === 'approve' ? 'Approve Selected Discounts' : 'Reject Selected Discounts'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to {bulkAction} {selectedDiscounts.length} discount(s).
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={bulkAction === 'approve' ? 'Approval Notes' : 'Rejection Reason'}
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            sx={{ mt: 2 }}
            required={bulkAction === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmBulkAction} 
            variant="contained"
            color={bulkAction === 'approve' ? 'success' : 'error'}
            disabled={bulkAction === 'reject' && !bulkReason.trim()}
          >
            {bulkAction === 'approve' ? 'Approve All' : 'Reject All'}
          </Button>
        </DialogActions>
      </Dialog>

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
                <Typography variant="subtitle2" color="text.secondary">Method</Typography>
                <Typography variant="body1" textTransform="capitalize">
                  {selectedDiscount.discount_type.discount_method.replace('_', ' ')}
                </Typography>
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
                <Typography variant="body1" fontWeight="bold">
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
          <Button 
            variant="contained" 
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => {
              if (selectedDiscount) {
                handleSingleAction(selectedDiscount, 'approve');
                setDetailDialogOpen(false);
              }
            }}
          >
            Approve
          </Button>
          <Button 
            variant="contained" 
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => {
              if (selectedDiscount) {
                handleSingleAction(selectedDiscount, 'reject');
                setDetailDialogOpen(false);
              }
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {SnackbarComponent}
    </Box>
  );
};
