import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import { guestsService, Guest, UpdateGuestInput } from '../../services/guests';

interface EditGuestDialogProps {
  open: boolean;
  guest: Guest | null;
  onClose: () => void;
  onUpdated: (guest: Guest) => void;
}

export const EditGuestDialog: React.FC<EditGuestDialogProps> = ({ open, guest, onClose, onUpdated }) => {
  const [form, setForm] = useState<UpdateGuestInput>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (guest) {
      setForm({
        first_name: guest.first_name,
        last_name: guest.last_name,
        email: guest.email,
        phone: guest.phone,
        membership_tier: typeof guest.membership_tier === 'string' ? guest.membership_tier : guest.membership_tier?.display_name,
      });
    }
  }, [guest]);

  const handleChange = (field: keyof UpdateGuestInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!guest) return;
    setIsSubmitting(true);
    try {
      const updated = await guestsService.update(guest.id, form);
      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update guest', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Guest</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="First Name"
          margin="normal"
          value={form.first_name || ''}
          onChange={handleChange('first_name')}
        />
        <TextField
          fullWidth
          label="Last Name"
          margin="normal"
          value={form.last_name || ''}
          onChange={handleChange('last_name')}
        />
        <TextField
          fullWidth
          label="Email"
          margin="normal"
          type="email"
          value={form.email || ''}
          onChange={handleChange('email')}
        />
        <TextField
          fullWidth
          label="Phone"
          margin="normal"
          value={form.phone || ''}
          onChange={handleChange('phone')}
        />
        <TextField
          fullWidth
          label="Membership Tier"
          margin="normal"
          value={(form as any).membership_tier || ''}
          onChange={handleChange('membership_tier')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};


