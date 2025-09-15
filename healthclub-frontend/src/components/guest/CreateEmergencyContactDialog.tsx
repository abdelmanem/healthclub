import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox, Box } from '@mui/material';

export interface EmergencyContactFormValues {
  id?: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

interface CreateEmergencyContactDialogProps {
  open: boolean;
  initialValue?: EmergencyContactFormValues | null;
  onClose: () => void;
  onSubmit: (values: EmergencyContactFormValues) => void;
}

const defaultValues: EmergencyContactFormValues = {
  name: '',
  relationship: '',
  phone: '',
  email: '',
  is_primary: false,
};

export const CreateEmergencyContactDialog: React.FC<CreateEmergencyContactDialogProps>
  = ({ open, initialValue, onClose, onSubmit }) => {
  const [values, setValues] = useState<EmergencyContactFormValues>(defaultValues);

  useEffect(() => {
    setValues(initialValue ? { ...defaultValues, ...initialValue } : defaultValues);
  }, [initialValue, open]);

  const handleChange = (field: keyof EmergencyContactFormValues) => (e: any) => {
    const value = field === 'is_primary' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{values.id ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, mt: 0.5 }}>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 8' } }}>
            <TextField fullWidth label="Name" value={values.name} onChange={handleChange('name')} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
            <FormControlLabel control={<Checkbox checked={values.is_primary} onChange={handleChange('is_primary')} />} label="Primary" />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
            <TextField fullWidth label="Relationship" value={values.relationship} onChange={handleChange('relationship')} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
            <TextField fullWidth label="Phone" value={values.phone} onChange={handleChange('phone')} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
            <TextField fullWidth label="Email" value={values.email} onChange={handleChange('email')} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};


