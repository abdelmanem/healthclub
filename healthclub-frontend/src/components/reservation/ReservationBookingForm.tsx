import React from 'react';
import { X, Plus, Trash2, Check, AlertCircle, Calendar, Clock, DollarSign, User, Users, FileText, CreditCard } from 'lucide-react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { api } from '../../services/api';
import { reservationsService, Reservation } from '../../services/reservations';
import { ConflictResolver } from './advanced/ConflictResolver';
import { guestsService } from '../../services/guests';
import { ReservationDepositForm } from './ReservationDepositForm';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface SelectedService {
  id: number;
  name: string;
  duration: number;
  price: number;
}

export const ReservationBookingForm: React.FC<{ 
  reservation?: Reservation | null; 
  onCreated?: () => void; 
  onSaved?: () => void; 
  onClose?: () => void; 
  initialStart?: string; 
  initialEmployeeId?: number; 
  initialLocationId?: number 
}> = ({ reservation, onCreated, onSaved, onClose, initialStart, initialEmployeeId, initialLocationId }) => {
  // Initialize dayjs plugins
  dayjs.extend(utc);
  dayjs.extend(timezone);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guestId, setGuestId] = React.useState<number | ''>('' as any);
  const [guestName, setGuestName] = React.useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = React.useState<number | ''>('' as any);
  const [selectedServices, setSelectedServices] = React.useState<SelectedService[]>([]);
  const [employeeId, setEmployeeId] = React.useState<number | ''>((initialEmployeeId as any) ?? ('' as any));
  const [locationId, setLocationId] = React.useState<number | ''>((initialLocationId as any) ?? ('' as any));
  const [start, setStart] = React.useState<string>(initialStart || dayjs().add(1, 'hour').minute(0).second(0).toISOString());
  const [totalPrice, setTotalPrice] = React.useState<number>(0);
  const [services, setServices] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [locations, setLocations] = React.useState<any[]>([]);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [conflicts, setConflicts] = React.useState<{ id: string | number; description: string }[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = React.useState<'unknown' | 'available' | 'unavailable' | 'error'>('unknown');
  const [availabilityReason, setAvailabilityReason] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<string>('');
  const [contactName, setContactName] = React.useState<string>('');
  const [email, setEmail] = React.useState<string>('');
  const [country, setCountry] = React.useState<string>('');
  const [countries, setCountries] = React.useState<Array<{ code: string; name: string }>>([]);
  const [phone, setPhone] = React.useState<string>('');
  const [phoneType, setPhoneType] = React.useState<'Mobile' | 'Home' | 'Work'>('Mobile');
  const [notes, setNotes] = React.useState<string>('');
  const [depositRequired, setDepositRequired] = React.useState<boolean>(false);
  const [depositAmount, setDepositAmount] = React.useState<string>('');
  const [markConfirmed, setMarkConfirmed] = React.useState<boolean>(false);
  const [cancelledCount, setCancelledCount] = React.useState<number>(0);
  const [depositDialogOpen, setDepositDialogOpen] = React.useState<boolean>(false);
  const [createdReservationId, setCreatedReservationId] = React.useState<number | null>(null);
  const hasPastCancellation = cancelledCount > 0;

  const resetForm = React.useCallback(() => {
    setGuestId('' as any);
    setGuestName('');
    setSelectedServiceId('' as any);
    setSelectedServices([]);
    setEmployeeId((initialEmployeeId as any) ?? ('' as any));
    setLocationId((initialLocationId as any) ?? ('' as any));
    setStart(initialStart || dayjs().add(1, 'hour').minute(0).second(0).toISOString());
    setTotalPrice(0);
    setSlots([]);
    setConflicts([]);
    setError(null);
    setSuccess(null);
    setAvailabilityStatus('unknown');
    setAvailabilityReason(null);
    setSource('');
    setContactName('');
    setEmail('');
    setCountry('');
    setPhone('');
    setPhoneType('Mobile');
    setNotes('');
    setDepositRequired(false);
    setDepositAmount('');
    setMarkConfirmed(false);
    setDepositDialogOpen(false);
    setCreatedReservationId(null);
  }, [initialEmployeeId, initialLocationId, initialStart]);

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
    const loadCountries = async () => {
      try {
        const supported = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('region') : [];
        if (Array.isArray(supported) && supported.length > 0) {
          const dn = new (Intl as any).DisplayNames(undefined, { type: 'region' });
          const items = supported
            .filter((c: string) => /^[A-Z]{2,3}$/.test(c))
            .map((code: string) => ({ code, name: dn.of(code) as string }))
            .filter((x: any) => !!x.name)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setCountries(items);
          return;
        }
      } catch {}
      try {
        const resp = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
        const data = await resp.json();
        const items = (Array.isArray(data) ? data : [])
          .map((r: any) => ({ code: r.cca2, name: r?.name?.common }))
          .filter((r: any) => r.code && r.name)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCountries(items);
      } catch {
        setCountries([]);
      }
    };
    loadCountries();
  }, []);

  React.useEffect(() => {
    if (reservation) {
      setGuestId(reservation.guest);
      setGuestName(reservation.guest_name ?? '');
      setLocationId((reservation.location ?? '') as any);
      if (reservation.employee !== undefined && reservation.employee !== null) {
        setEmployeeId(reservation.employee as any);
      }
      setStart(reservation.start_time);
      
      // Load full guest details to populate country and other fields
      if (reservation.guest) {
        guestsService.retrieve(reservation.guest).then((g: any) => {
          setContactName(`${g.first_name} ${g.last_name}`.trim());
          setEmail(g.email || '');
          setCountry(g.country || '');
        }).catch(() => {
          // If guest retrieval fails, just use the guest name from reservation
        });
      }
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
    if (typeof initialEmployeeId === 'number') {
      setEmployeeId(initialEmployeeId as any);
    }
    if (typeof initialLocationId === 'number') {
      setLocationId(initialLocationId as any);
    }
    if (initialStart) {
      setStart(initialStart);
    }
  }, [initialEmployeeId, initialLocationId, initialStart]);

  React.useEffect(() => {
    const gid = searchParams.get('guest');
    if (gid) {
      const idNum = Number(gid);
      if (!Number.isNaN(idNum)) {
        guestsService.retrieve(idNum).then((g: any) => {
          setGuestId(g.id);
          setGuestName(`${g.first_name} ${g.last_name}`.trim());
          setContactName(`${g.first_name} ${g.last_name}`.trim());
          setEmail(g.email || '');
          setCountry(g.country || '');
        }).catch(() => {
          setGuestId('' as any);
          setGuestName('');
        });
      }
    }
  }, [searchParams]);

  // When creating a NEW reservation and a guest is selected, check if they previously cancelled
  React.useEffect(() => {
    const loadCancelled = async () => {
      try {
        if (reservation || !guestId) { setCancelledCount(0); return; }
        const items = await reservationsService.list({ guest: Number(guestId), status: 'cancelled' });
        setCancelledCount(Array.isArray(items) ? items.length : 0);
      } catch {
        setCancelledCount(0);
      }
    };
    loadCancelled();
  }, [reservation, guestId]);

  React.useEffect(() => {
    const total = selectedServices.reduce((sum, service) => sum + service.price, 0);
    setTotalPrice(total);
  }, [selectedServices]);

  const computedEndIso = React.useMemo(() => {
    const durationMinutes = (reservation && reservation.start_time && reservation.end_time)
      ? dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute')
      : (selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60);
    return dayjs(start).add(durationMinutes, 'minute').toISOString();
  }, [reservation, selectedServices, start]);

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

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
      
      // Handle specific availability reasons
      let reason = null;
      if (!isAvailable && res.reason) {
        const resWithMessage = res as { available: boolean; reason?: string; message?: string; overlaps?: number; capacity?: number };
        switch (res.reason) {
          case 'employee_day_off':
            reason = 'Employee is scheduled for a day off on this date';
            break;
          case 'outside_working_hours':
            reason = resWithMessage.message || 'Reservation time is outside employee\'s working hours';
            break;
          case 'capacity_reached':
            reason = 'Room capacity has been reached for this time slot';
            break;
          case 'incompatible_room':
            reason = 'Selected service is not compatible with the chosen room';
            break;
          case 'out_of_service':
            reason = 'Selected room is out of service';
            break;
          default:
            reason = resWithMessage.message || res.reason;
        }
      }
      
      setAvailabilityReason(reason);
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

    try {
      let effectiveGuestId = guestId as number | '';
      if (!effectiveGuestId && phone) {
        try {
          const results = await guestsService.list({ search: phone });
          // Find exact phone number match first, then fallback to partial match
          const exactMatch = results.find((g: any) => (g.phone || '').replace(/\D/g, '') === phone.replace(/\D/g, ''));
          const match = exactMatch || results.find((g: any) => (g.phone || '').includes(phone));
          if (match) {
            effectiveGuestId = match.id;
            setGuestId(match.id);
            setGuestName(`${match.first_name} ${match.last_name}`.trim());
            setContactName(`${match.first_name} ${match.last_name}`.trim());
            setEmail(match.email || '');
            setCountry(match.country || '');
          }
        } catch {}
      }
      if (!effectiveGuestId) {
        const split = (contactName || '').trim().split(/\s+/);
        const first = split[0] || 'Guest';
        const last = split.slice(1).join(' ') || 'Unknown';
        const created = await guestsService.create({ first_name: first, last_name: last, email: email || '', phone: phone || '', country: country || '', membership_tier: null });
        effectiveGuestId = created.id as any;
        setGuestId(created.id);
        setGuestName(`${created.first_name} ${created.last_name}`.trim());
      }

      const reservationData: any = {
        guest: Number(effectiveGuestId),
        location: locationId ? Number(locationId) : null,
        start_time: start,
        notes: notes || undefined,
        deposit_required: depositRequired,
        deposit_amount: depositRequired && depositAmount ? depositAmount : undefined,
      };

      if (reservation && reservation.id && reservation.start_time && reservation.end_time) {
        const durationMinutes = dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute');
        reservationData.end_time = dayjs(start).add(durationMinutes, 'minute').toISOString();
      } else {
        const totalMinutesForCreate = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0) || 60;
        reservationData.end_time = dayjs(start).add(totalMinutesForCreate, 'minute').toISOString();
      }

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
        if (employeeId) {
          try {
            await api.post('/reservation-assignments/', {
              reservation: created.id,
              employee: Number(employeeId),
              role_in_service: 'Primary Therapist',
            });
          } catch (assignErr) {
            console.warn('Employee assignment failed:', assignErr);
          }
        }
        setSuccess('Reservation created');
        setCreatedReservationId(created.id);
        
        // If deposit is required, open deposit collection dialog
        if (depositRequired && depositAmount) {
          setDepositDialogOpen(true);
        } else {
          if (onCreated) onCreated();
        }
      }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{reservation ? 'Edit Reservation' : 'New Reservation'}</h1>
                  <p className="text-blue-100 text-sm">Create a booking for your guest</p>
                </div>
              </div>
              <button 
                onClick={() => { if (onClose) { onClose(); } else { navigate(-1); } }}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {success && (
            <div className="mx-8 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-800 text-sm font-medium">{success}</p>
            </div>
          )}
          {error && (
            <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="p-8 space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Guest Information</h2>
                {!reservation && hasPastCancellation && (
                  <span
                    className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-semibold"
                    title={`${cancelledCount} past cancellation${cancelledCount === 1 ? '' : 's'}`}
                  >
                    ❗ Previously Cancelled{cancelledCount > 0 ? ` (${cancelledCount})` : ''}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <label htmlFor="phone-number" className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      id="phone-number"
                      name="phone-number"
                      type="tel"
                      value={phone}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setPhone(v);
                        if ((v || '').replace(/\D/g, '').length >= 4) {
                          try {
                            const results = await guestsService.list({ search: v });
                            // Find exact phone number match first, then fallback to partial match
                            const exactMatch = results.find((g: any) => (g.phone || '').replace(/\D/g, '') === v.replace(/\D/g, ''));
                            const match = exactMatch || results.find((g: any) => (g.phone || '').includes(v));
                            if (match) {
                              setGuestId(match.id);
                              setGuestName(`${match.first_name} ${match.last_name}`.trim());
                              setContactName(`${match.first_name} ${match.last_name}`.trim());
                              setEmail(match.email || '');
                              setCountry(match.country || '');
                            } else {
                              // Clear guest data if no match found
                              setGuestId('' as any);
                              setGuestName('');
                              setContactName('');
                              setEmail('');
                              setCountry('');
                            }
                          } catch {}
                        } else {
                          // Clear guest data if phone is too short
                          setGuestId('' as any);
                          setGuestName('');
                          setContactName('');
                          setEmail('');
                          setCountry('');
                        }
                      }}
                      placeholder="+1 (555) 123-4567"
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <select
                      id="phone-type"
                      name="phone-type"
                      value={phoneType}
                      onChange={(e) => setPhoneType(e.target.value as any)}
                      className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="Mobile">Mobile</option>
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    id="contact-name"
                    name="contact-name"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <input
                    id="email-address"
                    name="email-address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <select
                    id="country"
                    name="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select country</option>
                    {countries.map(c => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Services</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <select
                  id="service-select"
                  name="service-select"
                  value={selectedServiceId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedServiceId(id as any);
                    if (!Number.isNaN(id)) {
                      addServiceById(id);
                      setSelectedServiceId('' as any);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select a service</option>
                  {services.filter(s => !selectedServices.find(ss => ss.id === s.id)).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.duration_minutes || 60} min - ${parseFloat(s.price || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addService}
                  disabled={!selectedServiceId}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {selectedServices.length > 0 && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-4">Selected Services</h3>
                  <div className="space-y-3 mb-6">
                    {selectedServices.map(service => (
                      <div key={service.id} className="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{service.name}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {service.duration} min
                            </span>
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {service.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeService(service.id)}
                          className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-600">Total Duration:</span>
                      <span className="font-semibold text-slate-900">{totalDuration} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-600">Total:</span>
                      <span className="text-2xl font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Booking Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="staff-member" className="block text-sm font-medium text-slate-700 mb-2">Staff Member</label>
                  <select
                    id="staff-member"
                    name="staff-member"
                    value={employeeId || ''}
                    onChange={(e) => setEmployeeId(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.full_name ?? `${e.first_name} ${e.last_name}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="room" className="block text-sm font-medium text-slate-700 mb-2">Room</label>
                  <select
                    id="room"
                    name="room"
                    value={locationId || ''}
                    onChange={(e) => setLocationId(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Any Available</option>
                    {locations.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="source" className="block text-sm font-medium text-slate-700 mb-2">Source</label>
                  <select
                    id="source"
                    name="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select source</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="phone">Phone</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="start-datetime" className="block text-sm font-medium text-slate-700 mb-2">Start Date & Time</label>
                  <input
                    id="start-datetime"
                    name="start-datetime"
                    type="datetime-local"
                    value={dayjs.utc(start).tz('Africa/Cairo').format('YYYY-MM-DDTHH:mm')}
                    onChange={(e) => setStart(dayjs.tz(e.target.value, 'Africa/Cairo').utc().toISOString())}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="end-datetime" className="block text-sm font-medium text-slate-700 mb-2">End Date & Time</label>
                  <input
                    id="end-datetime"
                    name="end-datetime"
                    type="datetime-local"
                    value={dayjs.utc(computedEndIso).tz('Africa/Cairo').format('YYYY-MM-DDTHH:mm')}
                    readOnly
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Availability</label>
                  <div className="flex gap-2">
                    <div className={`flex-1 px-4 py-3 rounded-xl border-2 flex items-center gap-2 ${
                      availabilityStatus === 'available' ? 'bg-emerald-50 border-emerald-200' :
                      availabilityStatus === 'unavailable' ? 'bg-red-50 border-red-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      {availabilityStatus === 'available' && (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">Available</span>
                        </>
                      )}
                      {availabilityStatus === 'unavailable' && (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-700">Unavailable</span>
                        </>
                      )}
                      {availabilityStatus === 'unknown' && (
                        <span className="text-sm text-slate-600">Unknown</span>
                      )}
                      {availabilityStatus === 'error' && (
                        <span className="text-sm text-amber-600">Error</span>
                      )}
                    </div>
                    <button
                      onClick={checkAvailability}
                      className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors font-medium"
                    >
                      Check
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Additional Information</h2>
              </div>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special requests or notes..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Deposit Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Deposit Requirements</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="depositRequired"
                    checked={depositRequired}
                    onChange={(e) => {
                      setDepositRequired(e.target.checked);
                      if (!e.target.checked) {
                        setDepositAmount('');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="depositRequired" className="text-sm font-medium text-slate-700">
                    Require deposit for this reservation
                  </label>
                </div>
                
                {depositRequired && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="deposit-amount" className="block text-sm font-medium text-slate-700 mb-2">
                        Deposit Amount
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <DollarSign className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          id="deposit-amount"
                          name="deposit-amount"
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Enter the deposit amount required to secure this reservation
                      </p>
                    </div>
                    
                    {/* Deposit Collection Info */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-start gap-3">
                        <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-blue-900 mb-1">
                            Deposit Collection
                          </h4>
                          <p className="text-xs text-blue-700 mb-2">
                            After creating the reservation, you'll be prompted to collect the deposit payment immediately.
                          </p>
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <Check className="w-3 h-3" />
                            <span>Payment methods will be available</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-blue-600 mt-1">
                            <Check className="w-3 h-3" />
                            <span>Deposit will be tracked separately</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <input
                type="checkbox"
                id="confirmed"
                checked={markConfirmed}
                onChange={(e) => setMarkConfirmed(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="confirmed" className="text-sm font-medium text-slate-700 cursor-pointer">
                Mark this reservation as confirmed
              </label>
            </div>

            {conflicts.length > 0 && (
              <Box mt={2}>
                <ConflictResolver conflicts={conflicts} onResolve={() => setConflicts([])} />
              </Box>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button 
            onClick={() => { if (onClose) { onClose(); } else { navigate(-1); } }}
            className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={resetForm}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors font-medium"
          >
            Reset
          </button>
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
          >
            Save Reservation
          </button>
        </div>
      </div>

      {/* Deposit Collection Dialog */}
      <Dialog
        open={depositDialogOpen}
        onClose={() => setDepositDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700,
          fontSize: '1.5rem'
        }}>
          Collect Deposit Payment
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {createdReservationId && (
            <ReservationDepositForm
              reservationId={createdReservationId}
              depositAmount={depositAmount}
              guestName={guestName}
              onDepositCollected={() => {
                setDepositDialogOpen(false);
                if (onCreated) onCreated();
              }}
              onClose={() => {
                setDepositDialogOpen(false);
                if (onCreated) onCreated();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};