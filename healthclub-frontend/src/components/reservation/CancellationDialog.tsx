import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  FormHelperText
} from '@mui/material';
import { CancellationReason } from '../../types/config';
import { useConfiguration } from '../../contexts/ConfigurationContext';
import { reservationsService } from '../../services/reservations';

interface CancellationDialogProps {
  open: boolean;
  onClose: () => void;
  reservationId: number | null;
  onCancelled?: () => void;
}

export const CancellationDialog: React.FC<CancellationDialogProps> = ({
  open,
  onClose,
  reservationId,
  onCancelled
}) => {
  const { cancellationReasons } = useConfiguration();
  const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedReasonId('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  const handleCancel = () => {
    onClose();
  };

  const handleSubmit = async () => {
    if (!reservationId) {
      setError('No reservation selected');
      return;
    }

    if (!selectedReasonId) {
      setError('Please select a cancellation reason');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Call the cancel endpoint with the selected reason
      await reservationsService.cancel(reservationId, {
        cancellation_reason: selectedReasonId,
        notes: notes.trim() || undefined
      });
      
      if (onCancelled) {
        onCancelled();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel reservation:', err);
      setError(err?.response?.data?.detail || 'Failed to cancel reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter only active cancellation reasons
  const activeReasons = cancellationReasons?.filter(reason => reason.is_active) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cancel Reservation</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="body2">
            Please select a reason for cancelling this reservation.
          </Typography>
          
          <FormControl fullWidth error={!!error && !selectedReasonId}>
            <InputLabel id="cancellation-reason-label">Cancellation Reason</InputLabel>
            <Select
              labelId="cancellation-reason-label"
              value={selectedReasonId}
              label="Cancellation Reason"
              onChange={(e) => setSelectedReasonId(e.target.value as number)}
              disabled={isSubmitting}
            >
              {activeReasons.map((reason: CancellationReason) => (
                <MenuItem key={reason.id} value={reason.id}>
                  {reason.name}
                </MenuItem>
              ))}
            </Select>
            {!!error && !selectedReasonId && (
              <FormHelperText>Please select a cancellation reason</FormHelperText>
            )}
          </FormControl>
          
          <TextField
            label="Additional Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            disabled={isSubmitting}
          />
          
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="error"
          disabled={isSubmitting || !selectedReasonId}
        >
          Confirm Cancellation
        </Button>
      </DialogActions>
    </Dialog>
  );
};