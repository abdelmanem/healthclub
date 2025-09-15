import React from 'react';
import { Box, TextField, MenuItem, Button, Typography, Alert } from '@mui/material';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import { reservationsService } from '../../services/reservations';
import { RecurringBookingManager } from './advanced/RecurringBookingManager';
import { WaitlistManager } from './advanced/WaitlistManager';
import { BookingRuleManager } from './advanced/BookingRuleManager';
import { ConflictResolver } from './advanced/ConflictResolver';

export const ReservationBookingForm: React.FC = () => {
  const [guestId, setGuestId] = React.useState<number | ''>('' as any);
  const [serviceId, setServiceId] = React.useState<number | ''>('' as any);
  const [employeeId, setEmployeeId] = React.useState<number | ''>('' as any);
  const [locationId, setLocationId] = React.useState<number | ''>('' as any);
  const [start, setStart] = React.useState<string>(dayjs().add(1, 'hour').minute(0).second(0).toISOString());
  const [price, setPrice] = React.useState<number | null>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [locations, setLocations] = React.useState<any[]>([]);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [conflicts, setConflicts] = React.useState<{ id: string | number; description: string }[]>([]);
  const [recurring, setRecurring] = React.useState({ enabled: false, frequency: 'weekly' as any, count: 4 });
  const [waitlist, setWaitlist] = React.useState({ enabled: false, maxWaitMinutes: 30 });
  const [rules, setRules] = React.useState({ minAdvanceHours: 1, maxAdvanceDays: 60, enforceGapMinutes: 10, enforceRules: true });
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const [svc, emp, loc] = await Promise.all([
        api.get('/services/'),
        api.get('/employees/'),
        api.get('/locations/').catch(() => ({ data: [] })),
      ]);
      setServices((svc.data.results ?? svc.data ?? []));
      setEmployees((emp.data.results ?? emp.data ?? []));
      setLocations((loc.data.results ?? loc.data ?? []));
    })();
  }, []);

  React.useEffect(() => {
    const calc = async () => {
      if (!serviceId) { setPrice(null); return; }
      try {
        const res = await api.get(`/services/${serviceId}/calculate-price/`).catch(() => ({ data: { price: null } }));
        setPrice(res.data.price ?? null);
      } catch {
        setPrice(null);
      }
    };
    calc();
  }, [serviceId]);

  const checkAvailability = async () => {
    try {
      const res = await api.get('/reservations/availability/', { params: {
        service: serviceId || undefined,
        employee: employeeId || undefined,
        location: locationId || undefined,
        start: start,
      }});
      setSlots(res.data?.slots ?? []);
      return true;
    } catch (e) {
      setSlots([]);
      return false;
    }
  };

  const detectConflicts = async () => {
    try {
      const res = await api.post('/reservations/conflict-check/', {
        service: serviceId || undefined,
        employee: employeeId || undefined,
        location: locationId || undefined,
        start: start,
      });
      const arr = res.data?.conflicts ?? [];
      setConflicts(arr.map((c: any, idx: number) => ({ id: idx, description: c.description || 'Conflict detected' })));
      return arr.length === 0;
    } catch (e) {
      setConflicts([]);
      return true;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!guestId || !serviceId || !start) {
      setError('Guest, service, and start time are required.');
      return;
    }
    const avail = await checkAvailability();
    const noConflicts = await detectConflicts();
    if (!avail) { setError('No availability for the selected time.'); return; }
    if (!noConflicts) { setError('Conflicts detected. Adjust time or override.'); return; }

    try {
      await reservationsService.create({
        guest: Number(guestId),
        service: Number(serviceId),
        employee: employeeId ? Number(employeeId) : null,
        location: locationId ? Number(locationId) : null,
        start_time: start,
      });
      setSuccess('Reservation created');
    } catch (e) {
      setError('Failed to create reservation');
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <TextField type="number" label="Guest ID" fullWidth value={guestId} onChange={(e) => setGuestId(Number(e.target.value))} />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <TextField select label="Service" fullWidth value={serviceId} onChange={(e) => setServiceId(e.target.value as any)}>
            {services.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <TextField select label="Employee" fullWidth value={employeeId} onChange={(e) => setEmployeeId(e.target.value as any)}>
            <MenuItem value="">Unassigned</MenuItem>
            {employees.map((e: any) => <MenuItem key={e.id} value={e.id}>{e.full_name ?? `${e.first_name} ${e.last_name}`}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <TextField select label="Location" fullWidth value={locationId} onChange={(e) => setLocationId(e.target.value as any)}>
            <MenuItem value="">Any</MenuItem>
            {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
          <TextField type="datetime-local" label="Start" fullWidth value={dayjs(start).format('YYYY-MM-DDTHH:mm')} onChange={(e) => setStart(dayjs(e.target.value).toISOString())} InputLabelProps={{ shrink: true }} />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 2' } }}>
          <TextField label="Price" fullWidth value={price ?? ''} InputProps={{ readOnly: true }} />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Typography variant="body2" color="text.secondary">Available Slots:</Typography>
          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
            {slots.length === 0 ? <Typography variant="caption" color="text.secondary">No slots loaded</Typography> : slots.map((s) => (
              <Button key={s} size="small" variant={dayjs(start).toISOString() === s ? 'contained' : 'outlined'} onClick={() => setStart(s)}>{dayjs(s).format('MMM D, HH:mm')}</Button>
            ))}
            <Button size="small" onClick={checkAvailability}>Refresh</Button>
          </Box>
        </Box>
      </Box>

      <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
        <BookingRuleManager onChange={setRules} value={rules} />
        <RecurringBookingManager enabled={recurring.enabled} onChange={(v) => setRecurring({ ...recurring, ...v })} value={recurring} />
        <WaitlistManager enabled={waitlist.enabled} onChange={(v) => setWaitlist({ ...waitlist, ...v })} value={waitlist} />
        <ConflictResolver conflicts={conflicts} onResolve={() => setConflicts([])} />
      </Box>

      <Box mt={2}>
        <Button variant="contained" onClick={handleSubmit}>Confirm Booking</Button>
      </Box>
    </Box>
  );
};


