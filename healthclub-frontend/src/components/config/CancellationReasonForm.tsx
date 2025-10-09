import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Box
} from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';
import { CancellationReason } from '../../types/config';
import { configService } from '../../services/config';
import { useConfiguration } from '../../contexts/ConfigurationContext';

interface CancellationReasonFormProps {
  open: boolean;
  onClose: () => void;
  editingReason: CancellationReason | null;
}

export const CancellationReasonForm: React.FC<CancellationReasonFormProps> = ({
  open,
  onClose,
  editingReason
}) => {
  const { refreshConfigurations } = useConfiguration();
  const [formData, setFormData] = useState<Partial<CancellationReason>>({
    code: '',
    name: '',
    description: '',
    sort_order: 0,
    is_active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingReason) {
      setFormData({
        id: editingReason.id,
        code: editingReason.code,
        name: editingReason.name,
        description: editingReason.description || '',
        sort_order: editingReason.sort_order || 0,
        is_active: editingReason.is_active
      });
    } else {
      // Reset form for new reason
      setFormData({
        code: '',
        name: '',
        description: '',
        sort_order: 0,
        is_active: true
      });
    }
    setErrors({});
  }, [editingReason, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.code?.trim()) {
      newErrors.code = 'Code is required';
    }
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      // Ensure sort_order is a number
      const dataToSubmit = {
        ...formData,
        sort_order: Number(formData.sort_order)
      };
      
      if (editingReason?.id) {
        // Update existing reason
        await configService.updateCancellationReason(editingReason.id, dataToSubmit);
      } else {
        // Create new reason
        await configService.createCancellationReason(dataToSubmit);
      }
      
      await refreshConfigurations();
      onClose();
    } catch (error) {
      console.error('Error saving cancellation reason:', error);
      setErrors({
        submit: 'Failed to save cancellation reason. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingReason ? 'Edit Cancellation Reason' : 'Add Cancellation Reason'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {errors.submit && (
            <Box sx={{ color: 'error.main', mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              {errors.submit}
            </Box>
          )}
          <TextField
            fullWidth
            label="Code"
            name="code"
            value={formData.code || ''}
            onChange={handleChange}
            margin="normal"
            error={!!errors.code}
            helperText={errors.code}
            required
            inputProps={{ maxLength: 50 }}
          />
          <TextField
            fullWidth
            label="Name"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            margin="normal"
            error={!!errors.name}
            helperText={errors.name}
            required
          />
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Sort Order"
            name="sort_order"
            type="number"
            value={formData.sort_order || 0}
            onChange={handleChange}
            margin="normal"
          />
          <FormControlLabel
            control={
              <Switch
                name="is_active"
                checked={formData.is_active ?? true}
                onChange={handleChange}
              />
            }
            label="Active"
          />
          {/* Error message moved to the top of the form */}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose} 
          startIcon={<Cancel />}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          startIcon={<Save />}
          disabled={isSubmitting}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};