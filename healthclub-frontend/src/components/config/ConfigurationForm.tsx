import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  Save,
  Cancel,
  Edit,
  Delete,
  Add,
  ContentCopy,
  History
} from '@mui/icons-material';

export interface ConfigurationFormProps {
  data: any;
  onChange: (data: any) => void;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onViewHistory?: () => void;
  loading?: boolean;
  readOnly?: boolean;
  showActions?: boolean;
  variant?: 'dialog' | 'inline';
}

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  data,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  onViewHistory,
  loading = false,
  readOnly = false,
  showActions = true,
  variant = 'dialog'
}) => {
  const [formData, setFormData] = useState(data || {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(data || {});
  }, [data]);

  const handleChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onChange(newData);
    
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Basic validation - can be extended based on configuration type
    if (!formData.name && formData.name !== undefined) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.code && formData.code !== undefined) {
      newErrors.code = 'Code is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm() && onSave) {
      onSave();
    }
  };

  const renderField = (field: string, label: string, type: string = 'text', options?: any[]) => {
    const value = formData[field] || '';
    const error = errors[field];

    switch (type) {
      case 'select':
        return (
          <FormControl fullWidth error={!!error}>
            <InputLabel>{label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleChange(field, e.target.value)}
              label={label}
              disabled={readOnly}
            >
              {options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'multiline':
        return (
          <TextField
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            multiline
            rows={3}
            error={!!error}
            helperText={error}
            disabled={readOnly}
          />
        );
      
      case 'number':
        return (
          <TextField
            fullWidth
            label={label}
            type="number"
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
          />
        );
      
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={value || false}
                onChange={(e) => handleChange(field, e.target.checked)}
                disabled={readOnly}
              />
            }
            label={label}
          />
        );
      
      case 'percentage':
        return (
          <TextField
            fullWidth
            label={label}
            type="number"
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            InputProps={{
              endAdornment: <Typography variant="body2" sx={{ ml: 1 }}>%</Typography>
            }}
            error={!!error}
            helperText={error}
            disabled={readOnly}
          />
        );
      
      default:
        return (
          <TextField
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
          />
        );
    }
  };

  const renderActions = () => {
    if (!showActions) return null;

    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onViewHistory && (
            <Tooltip title="View History">
              <IconButton onClick={onViewHistory} size="small">
                <History />
              </IconButton>
            </Tooltip>
          )}
          {onDuplicate && (
            <Tooltip title="Duplicate">
              <IconButton onClick={onDuplicate} size="small">
                <ContentCopy />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete">
              <IconButton onClick={onDelete} color="error" size="small">
                <Delete />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onCancel && (
            <Button
              onClick={onCancel}
              disabled={loading}
              startIcon={<Cancel />}
              variant="outlined"
            >
              Cancel
            </Button>
          )}
          {onSave && (
            <Button
              onClick={handleSave}
              disabled={loading}
              startIcon={<Save />}
              variant="contained"
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: variant === 'inline' ? 0 : 2 }}>
      <Grid container spacing={2}>
        {/* Basic Information */}
        <Grid xs={12}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit fontSize="small" />
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>
        
        <Grid xs={12} sm={6}>
          {renderField('code', 'Code')}
        </Grid>
        
        <Grid xs={12} sm={6}>
          {renderField('name', 'Name')}
        </Grid>
        
        <Grid xs={12}>
          {renderField('description', 'Description', 'multiline')}
        </Grid>

        {/* Configuration Specific Fields */}
        {formData.discount_percentage !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('discount_percentage', 'Discount Percentage', 'percentage')}
          </Grid>
        )}

        {formData.percentage !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('percentage', 'Percentage', 'percentage')}
          </Grid>
        )}

        {formData.category !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('category', 'Category')}
          </Grid>
        )}

        {formData.template_type !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('template_type', 'Template Type')}
          </Grid>
        )}

        {formData.subject !== undefined && (
          <Grid xs={12}>
            {renderField('subject', 'Subject')}
          </Grid>
        )}

        {formData.requires_tracking !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('requires_tracking', 'Requires Tracking', 'boolean')}
          </Grid>
        )}

        {formData.sort_order !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('sort_order', 'Sort Order', 'number')}
          </Grid>
        )}

        {/* Status */}
        <Grid xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            Status & Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>

        <Grid xs={12} sm={6}>
          {renderField('is_active', 'Active', 'boolean')}
        </Grid>

        {formData.is_default !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('is_default', 'Default', 'boolean')}
          </Grid>
        )}

        {/* Data Type for System Configs */}
        {formData.data_type !== undefined && (
          <Grid xs={12} sm={6}>
            {renderField('data_type', 'Data Type', 'select', [
              { value: 'string', label: 'String' },
              { value: 'integer', label: 'Integer' },
              { value: 'decimal', label: 'Decimal' },
              { value: 'boolean', label: 'Boolean' },
              { value: 'json', label: 'JSON' }
            ])}
          </Grid>
        )}

        {/* Value for System Configs */}
        {formData.value !== undefined && (
          <Grid xs={12}>
            {renderField('value', 'Value', formData.data_type === 'boolean' ? 'boolean' : 'multiline')}
          </Grid>
        )}
      </Grid>

      {renderActions()}
    </Box>
  );
};
