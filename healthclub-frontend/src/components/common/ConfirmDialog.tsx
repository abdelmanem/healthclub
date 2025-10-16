import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  inputLabel?: string;
  inputRequired?: boolean;
  inputType?: 'text' | 'number';
  inputPlaceholder?: string;
  inputHelperText?: string;
  inputMultiline?: boolean;
  inputRows?: number;
  validationError?: string;
  maxValue?: number;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  inputLabel,
  inputRequired = false,
  inputType = 'text',
  inputPlaceholder,
  inputHelperText,
  inputMultiline = false,
  inputRows = 3,
  validationError,
  maxValue,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setInputValue('');
      setError('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (inputRequired && !inputValue.trim()) {
      setError(`${inputLabel || 'Input'} is required`);
      return;
    }
    if (inputType === 'number' && inputValue) {
      const num = parseFloat(inputValue);
      if (isNaN(num) || num <= 0) {
        setError('Please enter a valid positive number');
        return;
      }
      if (maxValue && num > maxValue) {
        setError(`Value cannot exceed ${maxValue}`);
        return;
      }
    }
    onConfirm(inputValue);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: inputLabel ? 2 : 0 }}>
          {message}
        </Typography>

        {inputLabel && (
          <TextField
            autoFocus
            label={inputLabel}
            type={inputType}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            fullWidth
            required={inputRequired}
            placeholder={inputPlaceholder}
            helperText={error || inputHelperText}
            error={!!error}
            multiline={inputMultiline}
            rows={inputMultiline ? inputRows : 1}
            sx={{ mt: 2 }}
            inputProps={{
              min: inputType === 'number' ? 0.01 : undefined,
              max: inputType === 'number' && maxValue ? maxValue : undefined,
              step: inputType === 'number' ? 0.01 : undefined,
            }}
          />
        )}

        {validationError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelText}</Button>
        <Button onClick={handleConfirm} variant="contained" color={confirmColor} disabled={inputRequired && !inputValue.trim()}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};


