import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { guestsService, Guest, UpdateGuestInput } from '../../services/guests';
import { useConfiguration } from '../../contexts/ConfigurationContext';

interface EditGuestDialogProps {
  open: boolean;
  guest: Guest | null;
  onClose: () => void;
  onUpdated: (guest: Guest) => void;
}

export const EditGuestDialog: React.FC<EditGuestDialogProps> = ({ open, guest, onClose, onUpdated }) => {
  const [form, setForm] = useState<UpdateGuestInput>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { membershipTiers } = useConfiguration();

  useEffect(() => {
    if (guest) {
      setForm({
        first_name: guest.first_name,
        last_name: guest.last_name,
        email: guest.email,
        phone: guest.phone,
        // store the slug (name) for submission
        membership_tier: typeof guest.membership_tier === 'string' ? guest.membership_tier : (guest.membership_tier as any)?.name,
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
        <FormControl fullWidth margin="normal">
          <InputLabel id="edit-guest-membership-label">Membership Tier</InputLabel>
          <Select
            labelId="edit-guest-membership-label"
            label="Membership Tier"
            value={(form as any).membership_tier || ''}
            onChange={(e) => setForm(prev => ({ ...prev, membership_tier: e.target.value as any }))}
          >
            {membershipTiers.map((tier: any) => (
              <MenuItem key={tier.name} value={tier.name}>
                {tier.display_name || tier.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};


