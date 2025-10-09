import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box } from '@mui/material';
import dayjs from 'dayjs';
import { reservationsService, CreateReservationInput } from '../../services/reservations';
import { api } from '../../services/api';

interface QuickReservationDialogProps {
  open: boolean;
  guestId: number | null;
  onClose: () => void;
  onCreated?: (reservationId: number) => void;
}

interface Option {
  id: number;
  name: string;
}

export const QuickReservationDialog: React.FC<QuickReservationDialogProps> = ({ open, guestId, onClose, onCreated }) => {
  const [serviceId, setServiceId] = useState<number | ''>('' as any);
  const [employeeId, setEmployeeId] = useState<number | ''>('' as any);
  const [start, setStart] = useState<string>(dayjs().add(1, 'hour').minute(0).second(0).toISOString());
  const [notes, setNotes] = useState('');
  const [services, setServices] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadOptions();
    }
  }, [open]);

  const loadOptions = async () => {
    try {
      const [svcRes, empRes] = await Promise.all([
        api.get('/services/'),
        api.get('/employees/'),
      ]);
      setServices((svcRes.data.results ?? svcRes.data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
      setEmployees((empRes.data.results ?? empRes.data ?? []).map((e: any) => ({ id: e.id, name: e.full_name ?? `${e.first_name} ${e.last_name}` })));
    } catch (e) {
      console.error('Failed to load options', e);
    }
  };

  const handleSubmit = async () => {
    if (!guestId || !serviceId) return;
    setIsSubmitting(true);
    try {
      const payload: CreateReservationInput = {
        guest: guestId,
        service: Number(serviceId),
        employee: employeeId ? Number(employeeId) : null,
        start_time: start,
        notes: notes || undefined,
      };
      const res = await reservationsService.create(payload);
      onCreated?.(res.id);
      onClose();
      // reset minimal state
      setNotes('');
    } catch (e) {
      console.error('Failed to create reservation', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Quick Reservation</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, mt: 0.5 }}>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 8' } }}>
            <TextField
              select
              fullWidth
              label="Service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value as any)}
            >
              {services.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
            <TextField
              select
              fullWidth
              label="Employee (optional)"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value as any)}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {employees.map(e => (
                <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
            <TextField
              type="datetime-local"
              fullWidth
              label="Start"
              value={dayjs(start).format('YYYY-MM-DDTHH:mm')}
              onChange={(e) => setStart(dayjs(e.target.value).toISOString())}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 12' } }}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!guestId || !serviceId || isSubmitting}>Create</Button>
      </DialogActions>
    </Dialog>
  );
};


