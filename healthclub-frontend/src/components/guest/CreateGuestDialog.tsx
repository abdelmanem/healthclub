import React, { useState } from 'react';
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
import { guestsService, CreateGuestInput, Guest } from '../../services/guests';
import { useConfiguration } from '../../contexts/ConfigurationContext';

interface CreateGuestDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (guest: Guest) => void;
}

export const CreateGuestDialog: React.FC<CreateGuestDialogProps> = ({ open, onClose, onCreated }) => {
  const { membershipTiers } = useConfiguration();
  const [form, setForm] = useState<CreateGuestInput>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    membership_tier: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof CreateGuestInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSelectChange = (field: keyof CreateGuestInput) => (e: any) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const created = await guestsService.create(form);
      onCreated(created);
      onClose();
      setForm({ first_name: '', last_name: '', email: '', phone: '', membership_tier: '' });
    } catch (err) {
      console.error('Failed to create guest', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Guest</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="First Name"
          margin="normal"
          value={form.first_name}
          onChange={handleChange('first_name')}
        />
        <TextField
          fullWidth
          label="Last Name"
          margin="normal"
          value={form.last_name}
          onChange={handleChange('last_name')}
        />
        <TextField
          fullWidth
          label="Email"
          margin="normal"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
        />
        <TextField
          fullWidth
          label="Phone"
          margin="normal"
          value={form.phone}
          onChange={handleChange('phone')}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel id="membership-tier-label">Membership Tier</InputLabel>
          <Select
            labelId="membership-tier-label"
            id="membership-tier"
            value={form.membership_tier || ''}
            label="Membership Tier"
            onChange={handleSelectChange('membership_tier')}
          >
            {membershipTiers.map((tier) => (
              <MenuItem key={tier.id} value={tier.name}>
                {tier.display_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>Create</Button>
      </DialogActions>
    </Dialog>
  );
};


