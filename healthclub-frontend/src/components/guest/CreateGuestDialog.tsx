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
import { guestsService, CreateGuestInput, Guest, GuestAddress, EmergencyContact } from '../../services/guests';
import { useConfiguration } from '../../contexts/ConfigurationContext';
import { Grid, Checkbox, FormControlLabel, Divider } from '@mui/material';
import { useSnackbar } from '../common/useSnackbar';

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
    gender: undefined,
    date_of_birth: undefined,
    email: '',
    phone: '',
    membership_tier: '',
    country: '',
    medical_notes: '',
    email_notifications: true,
    sms_notifications: true,
    marketing_emails: false,
    addresses: [
      {
        id: 0 as any,
        address_type: 'home',
        street_address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'United States',
        is_primary: true,
      } as unknown as GuestAddress,
    ],
    emergency_contacts: [
      {
        id: 0 as any,
        name: '',
        relationship: '',
        phone: '',
        email: '',
        is_primary: true,
      } as unknown as EmergencyContact,
    ],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSnackbar, SnackbarComponent } = useSnackbar();

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
      setForm({
        first_name: '', last_name: '', gender: undefined, date_of_birth: undefined, email: '', phone: '', membership_tier: '',
        country: '', medical_notes: '', email_notifications: true, sms_notifications: true, marketing_emails: false,
        addresses: [{ id: 0 as any, address_type: 'home', street_address: '', city: '', state: '', postal_code: '', country: 'United States', is_primary: true } as unknown as GuestAddress],
        emergency_contacts: [{ id: 0 as any, name: '', relationship: '', phone: '', email: '', is_primary: true } as unknown as EmergencyContact],
      });
      showSnackbar('Guest created successfully', 'success');
    } catch (err: any) {
      showSnackbar(err?.response?.data?.error || 'Failed to create guest', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Guest</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="First Name"
              margin="none"
              value={form.first_name}
              onChange={handleChange('first_name')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              margin="none"
              value={form.last_name}
              onChange={handleChange('last_name')}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="none">
              <InputLabel id="gender-label">Gender</InputLabel>
              <Select
                labelId="gender-label"
                id="gender"
                value={form.gender || ''}
                label="Gender"
                onChange={handleSelectChange('gender')}
              >
                <MenuItem value="">Unspecified</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              margin="none"
              type="date"
              value={form.date_of_birth || ''}
              onChange={handleChange('date_of_birth') as any}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              margin="none"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              margin="none"
              value={form.phone}
              onChange={handleChange('phone')}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="none">
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
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Country"
              margin="none"
              value={form.country || ''}
              onChange={handleChange('country' as any)}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Medical Notes"
              margin="none"
              value={form.medical_notes || ''}
              onChange={handleChange('medical_notes' as any)}
              multiline
              rows={3}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={!!form.email_notifications} onChange={(_, v) => setForm(prev => ({ ...prev, email_notifications: v }))} />}
              label="Email Notifications"
            />
            <FormControlLabel
              control={<Checkbox checked={!!form.sms_notifications} onChange={(_, v) => setForm(prev => ({ ...prev, sms_notifications: v }))} />}
              label="SMS Notifications"
            />
            <FormControlLabel
              control={<Checkbox checked={!!form.marketing_emails} onChange={(_, v) => setForm(prev => ({ ...prev, marketing_emails: v }))} />}
              label="Marketing Emails"
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12}>
            <strong>Primary Address</strong>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Street Address"
              margin="none"
              value={form.addresses?.[0]?.street_address || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                addresses: [{ ...prev.addresses![0], street_address: e.target.value } as GuestAddress]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="City"
              margin="none"
              value={form.addresses?.[0]?.city || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                addresses: [{ ...prev.addresses![0], city: e.target.value } as GuestAddress]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="State"
              margin="none"
              value={form.addresses?.[0]?.state || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                addresses: [{ ...prev.addresses![0], state: e.target.value } as GuestAddress]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Postal Code"
              margin="none"
              value={form.addresses?.[0]?.postal_code || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                addresses: [{ ...prev.addresses![0], postal_code: e.target.value } as GuestAddress]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Country"
              margin="none"
              value={form.addresses?.[0]?.country || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                addresses: [{ ...prev.addresses![0], country: e.target.value } as GuestAddress]
              }))}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12}>
            <strong>Primary Emergency Contact</strong>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Name"
              margin="none"
              value={form.emergency_contacts?.[0]?.name || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                emergency_contacts: [{ ...prev.emergency_contacts![0], name: e.target.value } as EmergencyContact]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Relationship"
              margin="none"
              value={form.emergency_contacts?.[0]?.relationship || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                emergency_contacts: [{ ...prev.emergency_contacts![0], relationship: e.target.value } as EmergencyContact]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              margin="none"
              value={form.emergency_contacts?.[0]?.phone || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                emergency_contacts: [{ ...prev.emergency_contacts![0], phone: e.target.value } as EmergencyContact]
              }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              margin="none"
              value={form.emergency_contacts?.[0]?.email || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                emergency_contacts: [{ ...prev.emergency_contacts![0], email: e.target.value } as EmergencyContact]
              }))}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>Create</Button>
      </DialogActions>
      {SnackbarComponent}
    </Dialog>
  );
};


