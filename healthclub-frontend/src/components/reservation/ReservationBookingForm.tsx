import React from 'react';
import { Box, TextField, MenuItem, Button, Typography, Alert, Chip, Card, CardContent, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import { reservationsService } from '../../services/reservations';
import { RecurringBookingManager } from './advanced/RecurringBookingManager';
import { WaitlistManager } from './advanced/WaitlistManager';
import { BookingRuleManager } from './advanced/BookingRuleManager';
import { ConflictResolver } from './advanced/ConflictResolver';
import { GuestSearch } from '../guest/GuestSearch';
import { CreateGuestDialog } from '../guest/CreateGuestDialog';
import { guestsService } from '../../services/guests';
import { useSearchParams } from 'react-router-dom';

export const ReservationBookingForm: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const [searchParams] = useSearchParams();
  const [guestId, setGuestId] = React.useState<number | ''>('' as any);
  const [guestName, setGuestName] = React.useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<number | ''>('' as any);
  const [selectedServices, setSelectedServices] = React.useState<Array<{id: number, name: string, duration: number, price: number}>>([]);
  const [employeeId, setEmployeeId] = React.useState<number | ''>('' as any);
  const [locationId, setLocationId] = React.useState<number | ''>('' as any);
  const [start, setStart] = React.useState<string>(dayjs().add(1, 'hour').minute(0).second(0).toISOString());
  const [totalPrice, setTotalPrice] = React.useState<number>(0);
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
  const [availabilityStatus, setAvailabilityStatus] = React.useState<'unknown' | 'available' | 'unavailable' | 'error'>('unknown');

  React.useEffect(() => {
    (async () => {
      const [svc, emp, loc] = await Promise.all([
        api.get('/services/').catch(() => ({ data: [] })),
        api.get('/employees/').catch(() => ({ data: [] })),
        api.get('/locations/').catch(() => ({ data: [] })),
      ]);
      setServices((svc.data.results ?? svc.data ?? []));
      setEmployees((emp.data.results ?? emp.data ?? []));
      setLocations((loc.data.results ?? loc.data ?? []));
    })();
  }, []);

  React.useEffect(() => {
    const gid = searchParams.get('guest');
    if (gid) {
      const idNum = Number(gid);
      if (!Number.isNaN(idNum)) {
        guestsService.retrieve(idNum).then((g: any) => {
          setGuestId(g.id);
          setGuestName(`${g.first_name} ${g.last_name}`.trim());
        }).catch(() => {
          setGuestId('' as any);
          setGuestName('');
        });
      }
    }
  }, [searchParams]);

  React.useEffect(() => {
    // Calculate total price from selected services
    const total = selectedServices.reduce((sum, service) => sum + service.price, 0);
    setTotalPrice(total);
  }, [selectedServices]);

  const addService = () => {
    if (!selectedServiceId) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (service && !selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(prev => [...prev, {
        id: service.id,
        name: service.name,
        duration: service.duration_minutes || 60,
        price: parseFloat(service.price) || 0
      }]);
      setSelectedServiceId('' as any);
    }
  };

  const addServiceById = (id: number) => {
    const service = services.find((s: any) => s.id === id);
    if (service && !selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(prev => [...prev, {
        id: service.id,
        name: service.name,
        duration: service.duration_minutes || 60,
        price: parseFloat(service.price) || 0
      }]);
    }
  };

  const removeService = (serviceId: number) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
  };

  const checkAvailability = async () => {
    // If essential inputs are missing, don't block submission
    if (selectedServices.length === 0 || !start) {
      setAvailabilityStatus('unknown');
      setSlots([]);
      return true;
    }
    try {
      const res = await reservationsService.availability({
        service: selectedServices[0]?.id || undefined,
        employee: employeeId || undefined,
        location: locationId || undefined,
        start: start,
      });
      const isAvailable = !!res.available;
      setAvailabilityStatus(isAvailable ? 'available' : 'unavailable');
      setSlots([]);
      return isAvailable;
    } catch (e) {
      setAvailabilityStatus('error');
      setSlots([]);
      return true;
    }
  };

  const detectConflicts = async () => {
    try {
      // Compute end_time from selected services durations
      const totalMinutes = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60;
      const end = dayjs(start).add(totalMinutes, 'minute').toISOString();
      const res = await reservationsService.conflictCheck({
        start_time: start,
        end_time: end,
        location: locationId ? Number(locationId) : null,
      });
      const hasConflict = !!res.conflict;
      setConflicts(hasConflict ? [{ id: 1, description: 'Conflict detected for selected time range' }] : []);
      return !hasConflict;
    } catch (e) {
      setConflicts([]);
      return true;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!guestId || selectedServices.length === 0 || !start) {
      setError('Guest, at least one service, and start time are required.');
      return;
    }
    const avail = await checkAvailability();
    const noConflicts = await detectConflicts();
    if (!noConflicts) { setError('Conflicts detected. Adjust time or override.'); return; }

    try {
      // Create reservation with multiple services
      const reservationData: any = {
        guest: Number(guestId),
        //employee: employeeId ? Number(employeeId) : null,
        location: locationId ? Number(locationId) : null,
        start_time: start,
      };

      // Compute end_time from selected services
      const totalMinutesForCreate = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60;
      reservationData.end_time = dayjs(start).add(totalMinutesForCreate, 'minute').toISOString();

      // Add services in the format expected by the backend
      if (selectedServices.length > 0) {
        reservationData.reservation_services = selectedServices.map(service => ({
          service: service.id,
          quantity: 1
        }));
      }

      const created = await reservationsService.create(reservationData);
      // Assign employee if selected
      if (employeeId) {
        try {
          await api.post('/reservation-assignments/', {
            reservation: created.id,
            employee: Number(employeeId),
            role_in_service: 'Primary',
          });
        } catch (assignErr) {
          console.warn('Employee assignment failed:', assignErr);
        }
      }
      setSuccess('Reservation created');
      if (onCreated) onCreated();
      // Reset form
      setSelectedServices([]);
      setTotalPrice(0);
    } catch (e: any) {
      console.error('Reservation creation error:', e);
      const serverDetail = e?.response?.data;
      let msg = e?.response?.data?.detail || e?.message || 'Unknown error';
      if (serverDetail && typeof serverDetail === 'object' && !serverDetail.detail) {
        try {
          msg = JSON.stringify(serverDetail);
        } catch {}
      }
      setError(`Failed to create reservation: ${msg}`);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          {!guestId ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Search Guests</Typography>
              <GuestSearch onGuestSelect={(g: any) => { setGuestId(g.id); setGuestName(`${g.first_name} ${g.last_name}`.trim()); }} />
              <Box mt={1}>
                <Button size="small" variant="outlined" onClick={() => setIsCreateOpen(true)}>Add Guest</Button>
              </Box>
            </Box>
          ) : (
            <Box display="flex" alignItems="center" gap={1}>
              <Chip label={`Guest: ${guestName || guestId}`} />
              <Button size="small" onClick={() => { setGuestId('' as any); setGuestName(''); }}>Change</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
          <Box display="flex" gap={1}>
            <TextField 
              select 
              label="Add Service" 
              fullWidth 
              value={selectedServiceId} 
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedServiceId(id as any);
                if (!Number.isNaN(id)) {
                  addServiceById(id);
                  setSelectedServiceId('' as any);
                }
              }}
            >
              {services.filter(s => !selectedServices.find(ss => ss.id === s.id)).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Duration: {s.duration_minutes || 60} min | Price: ${parseFloat(s.price || 0).toFixed(2)}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <Button 
              variant="contained" 
              onClick={addService} 
              disabled={!selectedServiceId}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <Add />
            </Button>
          </Box>
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
          <TextField label="Total Price" fullWidth value={`$${totalPrice.toFixed(2)}`} InputProps={{ readOnly: true }} />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Typography variant="body2" color="text.secondary">Availability:</Typography>
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            {availabilityStatus === 'unknown' && (
              <Typography variant="caption" color="text.secondary">Unknown (click Check)</Typography>
            )}
            {availabilityStatus === 'available' && (
              <Typography variant="caption" color="success.main">Available</Typography>
            )}
            {availabilityStatus === 'unavailable' && (
              <Typography variant="caption" color="error.main">Unavailable</Typography>
            )}
            {availabilityStatus === 'error' && (
              <Typography variant="caption" color="warning.main">Could not check (server error)</Typography>
            )}
            <Button size="small" onClick={checkAvailability}>Check</Button>
          </Box>
        </Box>
      </Box>

      {/* Selected Services */}
      {selectedServices.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Selected Services</Typography>
            <List>
              {selectedServices.map((service) => (
                <ListItem key={service.id} divider>
                  <ListItemText
                    primary={service.name}
                    secondary={
                      <Box>
                        <Typography component="span" variant="body2" color="text.secondary">
                          Duration: {service.duration} min | Price: ${service.price.toFixed(2)}
                        </Typography>
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => removeService(service.id)}>
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Total: ${totalPrice.toFixed(2)}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Duration: {selectedServices.reduce((sum, s) => sum + s.duration, 0)} min
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <CreateGuestDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(g: any) => {
          setGuestId(g.id);
          setGuestName(`${g.first_name} ${g.last_name}`.trim());
          setIsCreateOpen(false);
        }}
      />

      <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
        <BookingRuleManager onChange={setRules} value={rules} />
        <RecurringBookingManager
          enabled={recurring.enabled}
          onChange={(v) => {
            // Guard against unnecessary updates to prevent update loops
            setRecurring((prev) => {
              const next = { ...prev, ...v };
              if (prev.enabled === next.enabled && prev.frequency === next.frequency && prev.count === next.count) {
                return prev; // no state change
              }
              return next;
            });
          }}
          value={recurring}
        />
        <WaitlistManager enabled={waitlist.enabled} onChange={(v) => setWaitlist({ ...waitlist, ...v })} value={waitlist} />
        <ConflictResolver conflicts={conflicts} onResolve={() => setConflicts([])} />
      </Box>

      <Box mt={2}>
        <Button variant="contained" onClick={handleSubmit}>Confirm Booking</Button>
      </Box>
    </Box>
  );
};


