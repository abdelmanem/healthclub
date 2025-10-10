/**
 * CheckOutDialog Component
 * 
 * Modal dialog for checking out completed reservations
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { CheckCircle, Receipt, CleaningServices } from '@mui/icons-material';
import { reservationsService } from '../../services/reservations';

interface CheckOutDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: {
    id: number;
    guest_name: string;
    location_name?: string;
    status: string;
    total_price?: string;
    services?: Array<{
      service_name: string;
      quantity: number;
      unit_price: string;
    }>;
  };
  onCheckOutSuccess: () => void;
}

export const CheckOutDialog: React.FC<CheckOutDialogProps> = ({
  open,
  onClose,
  reservation,
  onCheckOutSuccess,
}) => {
  const [createInvoice, setCreateInvoice] = useState(true);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setCreateInvoice(true);
      setNotes('');
      setError('');
    }
  }, [open]);

  // Handle submit
  const handleSubmit = async () => {
    setError('');
    setProcessing(true);

    try {
      const result = await reservationsService.checkOut(reservation.id, {
        create_invoice: createInvoice,
        notes: notes || undefined,
      });

      onCheckOutSuccess();
      onClose();

      // Show success message
      if (result.invoice_created) {
        alert(
          `Check-out successful!\n\n` +
          `Invoice created: ${result.invoice_number}\n` +
          `Total: $${result.invoice_total}\n` +
          `Housekeeping task created automatically.`
        );
      } else {
        alert(
          `Check-out successful!\n\n` +
          `Housekeeping task created automatically.\n` +
          `Invoice: ${result.invoice_created ? 'Created' : 'Not created'}`
        );
      }
    } catch (error: any) {
      setError(error?.response?.data?.error || 'Failed to check out reservation');
      setProcessing(false);
    }
  };

  const canCheckOut = reservation.status === 'completed';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircle color="primary" />
          <Typography variant="h6">Check Out Reservation</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Reservation Summary */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Reservation #{reservation.id}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Guest:</Typography>
              <Typography variant="body2" fontWeight={600}>
                {reservation.guest_name}
              </Typography>
            </Box>
            {reservation.location_name && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Location:</Typography>
                <Typography variant="body2">{reservation.location_name}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Status:</Typography>
              <Typography variant="body2" fontWeight={600} color="success.main">
                {reservation.status}
              </Typography>
            </Box>
            {reservation.total_price && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>Total:</Typography>
                <Typography variant="body2" fontWeight={700}>
                  ${parseFloat(reservation.total_price).toFixed(2)}
                </Typography>
              </Box>
            )}
          </Box>

          {!canCheckOut && (
            <Alert severity="warning">
              <Typography variant="body2">
                This reservation must be completed before it can be checked out.
                Current status: <strong>{reservation.status}</strong>
              </Typography>
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {/* Workflow Information */}
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Check-out Process:</strong>
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              <li>Mark reservation as checked out</li>
              <li>Free up the location</li>
              <li>Mark location as dirty</li>
              <li>Create housekeeping task automatically</li>
              {createInvoice && <li>Create invoice for payment processing</li>}
            </Box>
          </Alert>

          {/* Create Invoice Option */}
          <FormControlLabel
            control={
              <Checkbox
                checked={createInvoice}
                onChange={(e) => setCreateInvoice(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Create Invoice
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Generate invoice for payment processing after checkout
                </Typography>
              </Box>
            }
          />

          {/* Additional Notes */}
          <TextField
            label="Check-out Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Optional notes about the check-out process..."
            helperText="These notes will be added to the reservation and invoice"
          />

          {/* Services Summary */}
          {reservation.services && reservation.services.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Services Provided:
              </Typography>
              <Stack spacing={1}>
                {reservation.services.map((service, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">
                      {service.service_name} (x{service.quantity})
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      ${parseFloat(service.unit_price).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={processing || !canCheckOut}
          startIcon={processing ? <CircularProgress size={20} /> : <CheckCircle />}
        >
          {processing ? 'Processing...' : 'Check Out'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
