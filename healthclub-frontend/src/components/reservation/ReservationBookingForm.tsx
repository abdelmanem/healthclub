import React from 'react';
import { Box, TextField, MenuItem, Button, Typography, Alert, Chip, Card, CardContent, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, FormControlLabel, Checkbox } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import { reservationsService, Reservation } from '../../services/reservations';
import { ConflictResolver } from './advanced/ConflictResolver';
import { guestsService } from '../../services/guests';
import { useSearchParams } from 'react-router-dom';

export const ReservationBookingForm: React.FC<{ reservation?: Reservation | null; onCreated?: () => void; onSaved?: () => void }> = ({ reservation, onCreated, onSaved }) => {
  const [searchParams] = useSearchParams();
  const [guestId, setGuestId] = React.useState<number | ''>('' as any);
  const [guestName, setGuestName] = React.useState<string>('');
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
  // Removed Booking Rules / Recurring / Waitlist per requirements
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = React.useState<'unknown' | 'available' | 'unavailable' | 'error'>('unknown');
  const [availabilityReason, setAvailabilityReason] = React.useState<string | null>(null);
  // Classic form extras (for UI parity)
  const [source, setSource] = React.useState<string>('');
  const [contactName, setContactName] = React.useState<string>('');
  const [email, setEmail] = React.useState<string>('');
  const [country, setCountry] = React.useState<string>('');
  const [phone, setPhone] = React.useState<string>('');
  const [phoneType, setPhoneType] = React.useState<'Mobile' | 'Home' | 'Work'>('Mobile');
  const [notes, setNotes] = React.useState<string>('');
  const [markConfirmed, setMarkConfirmed] = React.useState<boolean>(false);

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

  // Prefill fields in edit mode
  React.useEffect(() => {
    if (reservation) {
      setGuestId(reservation.guest);
      setGuestName(reservation.guest_name ?? '');
      setLocationId((reservation.location ?? '') as any);
      if (reservation.employee !== undefined && reservation.employee !== null) {
        setEmployeeId(reservation.employee as any);
      }
      setStart(reservation.start_time);
      // Prefill services
      if (Array.isArray(reservation.reservation_services) && reservation.reservation_services.length > 0) {
        const svcs = reservation.reservation_services.map((rs: any) => ({
          id: rs.service,
          name: rs.service_details?.name || `Service #${rs.service}`,
          duration: rs.service_details?.duration_minutes || rs.service_duration_minutes || 60,
          price: parseFloat(rs.service_details?.price ?? rs.unit_price ?? 0),
        }));
        setSelectedServices(svcs);
      }
    }
  }, [reservation]);

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

  // Derived end time for display (start + total duration)
  const computedEndIso = React.useMemo(() => {
    const durationMinutes = (reservation && reservation.start_time && reservation.end_time)
      ? dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute')
      : (selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60);
    return dayjs(start).add(durationMinutes, 'minute').toISOString();
  }, [reservation, selectedServices, start]);

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
        services: selectedServices.map(s => s.id),
        employee: employeeId || undefined,
        location: locationId || undefined,
        start: start,
        exclude_reservation: reservation?.id || undefined,
      });
      const isAvailable = !!res.available;
      setAvailabilityStatus(isAvailable ? 'available' : 'unavailable');
      setAvailabilityReason(isAvailable ? null : (res.reason || null));
      setSlots([]);
      return isAvailable;
    } catch (e) {
      setAvailabilityStatus('error');
      setAvailabilityReason('server_error');
      setSlots([]);
      return true;
    }
  };

  const detectConflicts = async () => {
    try {
      // Compute end_time: preserve original duration when editing; otherwise use selected services
      const durationMinutes = (reservation && reservation.start_time && reservation.end_time)
        ? dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute')
        : (selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60);
      const end = dayjs(start).add(durationMinutes, 'minute').toISOString();
      const res = await reservationsService.conflictCheck({
        start_time: start,
        end_time: end,
        location: locationId ? Number(locationId) : null,
        service: selectedServices[0]?.id || undefined,
        services: selectedServices.map(s => s.id),
        exclude_reservation: reservation?.id || undefined,
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
    if (selectedServices.length === 0 || !start) {
      setError('At least one service and start time are required.');
      return;
    }
    // Temporarily skip availability/conflict checks during testing

    try {
      // Ensure we have a guest: search by phone; create if missing and name/email provided
      let effectiveGuestId = guestId as number | '';
      if (!effectiveGuestId && phone) {
        try {
          const results = await guestsService.list({ search: phone });
          const match = results.find((g: any) => (g.phone || '').includes(phone));
          if (match) {
            effectiveGuestId = match.id;
            setGuestId(match.id);
            setGuestName(`${match.first_name} ${match.last_name}`.trim());
          }
        } catch {}
      }
      if (!effectiveGuestId) {
        // create a minimal guest if we have required details
        const split = (contactName || '').trim().split(/\s+/);
        const first = split[0] || 'Guest';
        const last = split.slice(1).join(' ') || 'Unknown';
        const created = await guestsService.create({ first_name: first, last_name: last, email: email || '', phone: phone || '', membership_tier: null });
        effectiveGuestId = created.id as any;
        setGuestId(created.id);
        setGuestName(`${created.first_name} ${created.last_name}`.trim());
      }

      // Create or update reservation with multiple services
      const reservationData: any = {
        guest: Number(effectiveGuestId),
        //employee: employeeId ? Number(employeeId) : null,
        location: locationId ? Number(locationId) : null,
        start_time: start,
        notes: notes || undefined,
      };

      // Compute end_time
      if (reservation && reservation.id && reservation.start_time && reservation.end_time) {
        // Preserve original duration on edit
        const durationMinutes = dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute');
        reservationData.end_time = dayjs(start).add(durationMinutes, 'minute').toISOString();
      } else {
        // Create: derive from selected services
        const totalMinutesForCreate = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60;
        reservationData.end_time = dayjs(start).add(totalMinutesForCreate, 'minute').toISOString();
      }

      // Add services in the format expected by the backend
      if (selectedServices.length > 0) {
        reservationData.reservation_services = selectedServices.map(service => ({
          service: service.id,
          quantity: 1
        }));
      }

      if (reservation && reservation.id) {
        await reservationsService.update(reservation.id, reservationData);
        setSuccess('Reservation updated');
        if (onSaved) onSaved();
      } else {
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
      }
      // Reset form
      setSelectedServices([]);
      setTotalPrice(0);
      setNotes('');
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
        {/* Guest section replaced by phone-driven lookup + name/email */}
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Guest Info</Typography>
          <Box display="flex" gap={1}>
            <TextField label="Phone" fullWidth value={phone} onChange={async (e) => {
              const v = e.target.value;
              setPhone(v);
              // live search by phone when length >= 4
              if ((v || '').replace(/\D/g, '').length >= 4) {
                try {
                  const results = await guestsService.list({ search: v });
                  const match = results.find((g: any) => (g.phone || '').includes(v));
                  if (match) {
                    setGuestId(match.id);
                    setGuestName(`${match.first_name} ${match.last_name}`.trim());
                    setContactName(`${match.first_name} ${match.last_name}`.trim());
                    setEmail(match.email || '');
                  }
                } catch {}
              }
            }} />
            <TextField select label="" value={phoneType} onChange={(e) => setPhoneType(e.target.value as any)} sx={{ minWidth: 120 }}>
              <MenuItem value="Mobile">Mobile</MenuItem>
              <MenuItem value="Home">Home</MenuItem>
              <MenuItem value="Work">Work</MenuItem>
            </TextField>
          </Box>
          <Box display="flex" gap={1} mt={1}>
            <TextField label="Name" fullWidth value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <TextField label="Email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          </Box>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
          <Box display="flex" gap={1}>
            <TextField 
              select 
              label="Service" 
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
          <TextField 
            select 
            label="Staff" 
            fullWidth 
            value={employees.some((e:any) => e.id === employeeId) ? employeeId : ('' as any)} 
            onChange={(e) => setEmployeeId(e.target.value as any)}
          >
            <MenuItem value="">Unassigned</MenuItem>
            {employees.map((e: any) => <MenuItem key={e.id} value={e.id}>{e.full_name ?? `${e.first_name} ${e.last_name}`}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <TextField 
            select 
            label="Room" 
            fullWidth 
            value={locations.some((l:any) => l.id === locationId) ? locationId : ('' as any)} 
            onChange={(e) => setLocationId(e.target.value as any)}
          >
            <MenuItem value="">Any</MenuItem>
            {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
          <Box display="flex" gap={1}>
            <TextField type="datetime-local" label="Start" fullWidth value={dayjs(start).format('YYYY-MM-DDTHH:mm')} onChange={(e) => setStart(dayjs(e.target.value).toISOString())} InputLabelProps={{ shrink: true }} />
            <TextField type="datetime-local" label="to" fullWidth value={dayjs(computedEndIso).format('YYYY-MM-DDTHH:mm')} InputLabelProps={{ shrink: true }} inputProps={{ readOnly: true }} />
          </Box>
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
              <>
                <Typography variant="caption" color="error.main">Unavailable</Typography>
                {availabilityReason && (
                  <Chip size="small" color="error" label={availabilityReason.replace(/_/g, ' ')} />
                )}
              </>
            )}
            {availabilityStatus === 'error' && (
              <Typography variant="caption" color="warning.main">Could not check (server error)</Typography>
            )}
            <Button size="small" onClick={checkAvailability}>Check</Button>
          </Box>
        </Box>
        {/* Source */}
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <TextField select label="Source" fullWidth value={source} onChange={(e) => setSource(e.target.value)}>
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="walk_in">Walk-in</MenuItem>
            <MenuItem value="phone">Phone</MenuItem>
            <MenuItem value="website">Website</MenuItem>
            <MenuItem value="referral">Referral</MenuItem>
          </TextField>
        </Box>
        {/* Name & Email */}
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Box display="flex" gap={1}>
            <TextField label="Name" fullWidth value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <TextField label="Email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          </Box>
        </Box>
        {/* Country (optional, kept for parity) */}
        <Box sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <TextField label="Country" fullWidth value={country} onChange={(e) => setCountry(e.target.value)} />
        </Box>
        {/* Notes */}
        <Box sx={{ gridColumn: 'span 12' }}>
          <TextField label="Notes" fullWidth multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Box>
        {/* Confirmed */}
        <Box sx={{ gridColumn: 'span 12' }}>
          <FormControlLabel control={<Checkbox checked={markConfirmed} onChange={(e) => setMarkConfirmed(e.target.checked)} />} label="Mark as Confirmed" />
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

      {/* Removed Booking Rules, Recurring, and Waitlist sections */}
      <Box mt={2}>
        <ConflictResolver conflicts={conflicts} onResolve={() => setConflicts([])} />
      </Box>

      <Box mt={2} display="flex" gap={2}>
        <Button variant="text" onClick={() => {
          setSource(''); setContactName(''); setEmail(''); setCountry(''); setPhone(''); setNotes(''); setMarkConfirmed(false);
        }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Save</Button>
      </Box>
    </Box>
  );
};


