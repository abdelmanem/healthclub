/**
 * Discount Type Manager
 * 
 * CRUD operations for discount types including:
 * - Create/edit/delete discount types
 * - Configure rules and limits
 * - Set approval requirements
 * - Manage validity periods
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
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
  Switch,
  FormControlLabel,
  Grid,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../common/useSnackbar';
import { discountService, DiscountType } from '../../services/discounts';

interface DiscountTypeManagerProps {
  onRefresh: () => void;
}

export const DiscountTypeManager: React.FC<DiscountTypeManagerProps> = ({ onRefresh }) => {
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountType | null>(null);
  const [formData, setFormData] = useState<Partial<DiscountType>>({
    name: '',
    code: '',
    description: '',
    discount_method: 'percentage',
    discount_value: 0,
    max_discount_amount: undefined,
    min_order_amount: undefined,
    is_active: true,
    requires_approval: false,
    usage_limit_per_guest: undefined,
    usage_limit_per_day: undefined,
    valid_from: undefined,
    valid_until: undefined,
  });
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Load discount types
  const loadDiscountTypes = async () => {
    setLoading(true);
    try {
      const data = await discountService.listDiscountTypes();
      setDiscountTypes(data);
    } catch (error) {
      console.error('Failed to load discount types:', error);
      showSnackbar('Failed to load discount types', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscountTypes();
  }, []);

  const handleOpenDialog = (discount?: DiscountType) => {
    if (discount) {
      setEditingDiscount(discount);
      setFormData({
        ...discount,
        valid_from: discount.valid_from ? new Date(discount.valid_from).toISOString().slice(0, 16) : undefined,
        valid_until: discount.valid_until ? new Date(discount.valid_until).toISOString().slice(0, 16) : undefined,
      });
    } else {
      setEditingDiscount(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        discount_method: 'percentage',
        discount_value: 0,
        max_discount_amount: undefined,
        min_order_amount: undefined,
        is_active: true,
        requires_approval: false,
        usage_limit_per_guest: undefined,
        usage_limit_per_day: undefined,
        valid_from: undefined,
        valid_until: undefined,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDiscount(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      discount_method: 'percentage',
      discount_value: 0,
      max_discount_amount: undefined,
      min_order_amount: undefined,
      is_active: true,
      requires_approval: false,
      usage_limit_per_guest: undefined,
      usage_limit_per_day: undefined,
      valid_from: undefined,
      valid_until: undefined,
    });
  };

  const handleSave = async () => {
    try {
      if (editingDiscount) {
        await discountService.updateDiscountType(editingDiscount.id, formData);
        showSnackbar('Discount type updated successfully', 'success');
      } else {
        await discountService.createDiscountType(formData);
        showSnackbar('Discount type created successfully', 'success');
      }
      handleCloseDialog();
      loadDiscountTypes();
      onRefresh();
    } catch (error: any) {
      console.error('Failed to save discount type:', error);
      showSnackbar('Failed to save discount type: ' + (error.response?.data?.detail || error.message), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this discount type?')) {
      try {
        await discountService.deleteDiscountType(id);
        showSnackbar('Discount type deleted successfully', 'success');
        loadDiscountTypes();
        onRefresh();
      } catch (error: any) {
        console.error('Failed to delete discount type:', error);
        showSnackbar('Failed to delete discount type: ' + (error.response?.data?.detail || error.message), 'error');
      }
    }
  };

  const getStatusColor = (discountType: DiscountType) => {
    if (!discountType.is_active) return 'default';
    if (!discountType.is_valid_now) return 'warning';
    return 'success';
  };

  const getStatusLabel = (discountType: DiscountType) => {
    if (!discountType.is_active) return 'Inactive';
    if (!discountType.is_valid_now) return 'Expired';
    return 'Active';
  };

  const formatDiscountValue = (discountType: DiscountType) => {
    switch (discountType.discount_method) {
      case 'percentage':
        return `${discountType.discount_value}%`;
      case 'fixed_amount':
        return `$${discountType.discount_value}`;
      case 'free_service':
        return 'Free Service';
      default:
        return 'Unknown';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Discount Types ({discountTypes.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Discount Type
        </Button>
      </Box>

      {/* Discount Types Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Approval Required</TableCell>
              <TableCell>Usage Limits</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : discountTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No discount types found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              discountTypes.map((discountType) => (
                <TableRow key={discountType.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {discountType.name}
                    </Typography>
                    {discountType.description && (
                      <Typography variant="caption" color="text.secondary">
                        {discountType.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={discountType.code} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" textTransform="capitalize">
                      {discountType.discount_method.replace('_', ' ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatDiscountValue(discountType)}
                    </Typography>
                    {discountType.max_discount_amount && (
                      <Typography variant="caption" color="text.secondary">
                        Max: ${discountType.max_discount_amount}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(discountType)} 
                      color={getStatusColor(discountType)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {discountType.requires_approval ? (
                      <Chip label="Yes" color="warning" size="small" />
                    ) : (
                      <Chip label="No" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      {discountType.usage_limit_per_guest && (
                        <Typography variant="caption">
                          Per Guest: {discountType.usage_limit_per_guest}
                        </Typography>
                      )}
                      {discountType.usage_limit_per_day && (
                        <Typography variant="caption">
                          Per Day: {discountType.usage_limit_per_day}
                        </Typography>
                      )}
                      {!discountType.usage_limit_per_guest && !discountType.usage_limit_per_day && (
                        <Typography variant="caption" color="text.secondary">
                          Unlimited
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(discountType)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDelete(discountType.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingDiscount ? 'Edit Discount Type' : 'Create Discount Type'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                helperText="Unique identifier (e.g., FIRST_TIME)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Discount Method</InputLabel>
                <Select
                  value={formData.discount_method}
                  onChange={(e) => setFormData({ ...formData, discount_method: e.target.value as any })}
                >
                  <MenuItem value="percentage">Percentage</MenuItem>
                  <MenuItem value="fixed_amount">Fixed Amount</MenuItem>
                  <MenuItem value="free_service">Free Service</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Discount Value"
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                required
                helperText={formData.discount_method === 'percentage' ? 'Percentage (0-100)' : 'Amount in dollars'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Discount Amount"
                type="number"
                value={formData.max_discount_amount || ''}
                onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value ? Number(e.target.value) : undefined })}
                helperText="Maximum discount amount (for percentage discounts)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Min Order Amount"
                type="number"
                value={formData.min_order_amount || ''}
                onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value ? Number(e.target.value) : undefined })}
                helperText="Minimum order amount required"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Usage Limit Per Guest"
                type="number"
                value={formData.usage_limit_per_guest || ''}
                onChange={(e) => setFormData({ ...formData, usage_limit_per_guest: e.target.value ? Number(e.target.value) : undefined })}
                helperText="Maximum uses per guest (leave empty for unlimited)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Usage Limit Per Day"
                type="number"
                value={formData.usage_limit_per_day || ''}
                onChange={(e) => setFormData({ ...formData, usage_limit_per_day: e.target.value ? Number(e.target.value) : undefined })}
                helperText="Maximum uses per day (leave empty for unlimited)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Valid From"
                type="datetime-local"
                value={formData.valid_from || ''}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Valid Until"
                type="datetime-local"
                value={formData.valid_until || ''}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Active"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.requires_approval}
                      onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                    />
                  }
                  label="Requires Approval"
                />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={!formData.name || !formData.code}
          >
            {editingDiscount ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {SnackbarComponent}
    </Box>
  );
};
