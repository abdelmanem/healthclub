import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField, FormControlLabel, Checkbox, MenuItem } from '@mui/material';

export interface AddressFormValues {
  id?: number;
  address_type: 'home' | 'work' | 'billing';
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

interface CreateAddressDialogProps {
  open: boolean;
  initialValue?: AddressFormValues | null;
  onClose: () => void;
  onSubmit: (values: AddressFormValues) => void;
}

const defaultValues: AddressFormValues = {
  address_type: 'home',
  street_address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'United States',
  is_primary: false,
};

export const CreateAddressDialog: React.FC<CreateAddressDialogProps> = ({ open, initialValue, onClose, onSubmit }) => {
  const [values, setValues] = useState<AddressFormValues>(defaultValues);

  useEffect(() => {
    setValues(initialValue ? { ...defaultValues, ...initialValue } : defaultValues);
  }, [initialValue, open]);

  const handleChange = (field: keyof AddressFormValues) => (e: any) => {
    const value = field === 'is_primary' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{values.id ? 'Edit Address' : 'Add Address'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Type" value={values.address_type} onChange={handleChange('address_type')}>
              <MenuItem value="home">Home</MenuItem>
              <MenuItem value="work">Work</MenuItem>
              <MenuItem value="billing">Billing</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel control={<Checkbox checked={values.is_primary} onChange={handleChange('is_primary')} />} label="Primary" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Street Address" value={values.street_address} onChange={handleChange('street_address')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="City" value={values.city} onChange={handleChange('city')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="State" value={values.state} onChange={handleChange('state')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="Postal Code" value={values.postal_code} onChange={handleChange('postal_code')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Country" value={values.country} onChange={handleChange('country')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};


