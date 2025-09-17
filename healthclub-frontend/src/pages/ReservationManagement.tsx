import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Button,
  Tabs,
  Tab,
  Grid,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  Stack,
  Paper,
} from '@mui/material';
import { Add, Check, DirectionsRun, DoneAll, Logout, Edit } from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation, ReservationService } from '../services/reservations';
import { api } from '../services/api';

// Helper: status color
const statusColor = (status?: string) => {
  switch (status) {
    case 'booked': return '#1976d2';
    case 'confirmed': return '#1976d2';
    case 'checked_in': return '#ed6c02';
    case 'in_service': return '#f97316';
    case 'completed': return '#10b981';
    case 'cancelled': return '#ef4444';
    default: return '#0288d1';
  }
};

export const ReservationManagement: React.FC = () => {
  const [tab, setTab] = useState<number>(4); // 4 = Calendar tab by default
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // calendar & filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string>('');

  const [groupBy, setGroupBy] = useState<'location'|'employee'|'none'>('none');
  const [showTimers, setShowTimers] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  const calendarRef = useRef<any>(null);

  // drag-drop confirmation dialog state
  const [pendingMove, setPendingMove] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // KPI
  const [kpi, setKpi] = useState({ arrivalsToday: 0, checkedInNow: 0, inServiceNow: 0, revenueToday: 0 });

  // New reservation form state
  const [editing, setEditing] = useState<Reservation | null | undefined>(undefined);
  const [formVersion, setFormVersion] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const [loc, emp] = await Promise.all([
          api.get('/locations/').catch(() => ({ data: { results: [] } })),
          api.get('/employees/').catch(() => ({ data: { results: [] } }))
        ]);
        setLocations(loc.data.results ?? loc.data ?? []);
        setEmployees(emp.data.results ?? emp.data ?? []);
      } catch (e) {
        console.error('Failed to load locations/employees', e);
      }
    })();
  }, []);

  const loadReservations = async (params: any = {}) => {
    setLoading(true);
    try {
      const data = await reservationsService.list(params);
      setReservations(Array.isArray(data) ? data : ((data as any).results ?? data));
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally { 
      setLoading(false); 
    }
  };

  // initial load
  useEffect(() => { 
    loadReservations(); 
  }, []);

  // KPI compute
  useEffect(() => {
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    const arrivalsToday = reservations.filter(r => 
      dayjs(r.start_time).isBetween(todayStart, todayEnd, null, '[]') && 
      ['booked','confirmed','pending'].includes(r.status ?? 'pending')
    ).length;
    const checkedInNow = reservations.filter(r => r.status === 'checked_in').length;
    const inServiceNow = reservations.filter(r => r.status === 'in_service').length;
    const revenueToday = reservations.reduce((s, r) => {
      const st = dayjs(r.start_time);
      if (st.isBetween(todayStart, todayEnd, null, '[]')) return s + (Number(r.total_price) || 0);
      return s;
    }, 0);
    setKpi({ arrivalsToday, checkedInNow, inServiceNow, revenueToday });
  }, [reservations]);

  // now ticker: only when calendar tab active and timers enabled
  useEffect(() => {
    if (tab !== 4 || !showTimers) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tab, showTimers]);

  // map reservations -> calendar events
  const events = reservations
    .filter(r => !statusFilter || (r.status ?? '').toString() === statusFilter)
    .filter(r => !locationFilter || String(r.location) === locationFilter)
    .filter(r => !employeeFilter || String(r.employee) === employeeFilter)
    .filter(r => !guestSearch || (r.guest_name ?? '').toLowerCase().includes(guestSearch.toLowerCase()))
    .filter(r => !serviceFilter || (r.reservation_services || []).some((s:any) => 
      (s.service_details?.name || '').toLowerCase() === serviceFilter.toLowerCase() || 
      String(s.service) === serviceFilter
    ))
    .map(r => ({
      id: String(r.id),
      title: `${r.guest_name ?? 'Guest'}`,
      start: r.start_time,
      end: r.end_time,
      backgroundColor: statusColor(r.status),
      borderColor: '#ffffff',
      textColor: '#fff',
      extendedProps: { reservation: r, status: r.status, locationId: r.location, employeeId: r.employee },
      resourceId: groupBy === 'location' ? String(r.location) : (groupBy === 'employee' ? String(r.employee) : undefined),
      editable: true,
    }));

  // resources for timeline grouping
  const resources = (groupBy === 'location' ? locations : groupBy === 'employee' ? employees : []).map((x:any) => ({ 
    id: String(x.id), 
    title: x.name 
  }));

  // event rendering (adds live timer for in_service)
  const renderEventContent = (arg:any) => {
    const ev:any = arg.event;
    const props = ev.extendedProps || {};
    const status = props.status;
    const start = ev.start ? ev.start.getTime() : null;
    let timerNode = null;
    if (showTimers && status === 'in_service' && start) {
      const diffSec = Math.max(0, Math.floor((now - start) / 1000));
      const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const ss = String(diffSec % 60).padStart(2, '0');
      timerNode = (<div style={{ fontSize: 11, marginTop: 4 }}>{`⏱ ${hh}:${mm}:${ss}`}</div>);
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{ev.title}</div>
        {timerNode}
      </div>
    );
  };

  // event click -> open drawer
  const onEventClick = (clickInfo:any) => {
    const r = clickInfo.event.extendedProps?.reservation;
    if (r) { 
      setSelectedReservation(r); 
      setDrawerOpen(true); 
    }
  };

  // event drop (drag) -> show confirmation dialog before saving
  const onEventDrop = (dropInfo:any) => {
    const event = dropInfo.event;
    const res = event.extendedProps?.reservation;
    const oldStart = dropInfo.oldEvent.start;
    const oldEnd = dropInfo.oldEvent.end;
    const newStart = event.start;
    const newEnd = event.end;
    const oldResource = (dropInfo.oldEvent as any).getResources ? (dropInfo.oldEvent as any).getResources()[0]?.id : null;
    const newResource = (event as any).getResources ? (event as any).getResources()[0]?.id : null;
    setPendingMove({ dropInfo, res, oldStart, oldEnd, newStart, newEnd, oldResource, newResource });
  };

  // cancel pending move
  const cancelPendingMove = () => {
    if (pendingMove?.dropInfo) pendingMove.dropInfo.revert();
    setPendingMove(null);
  };

  // confirm pending move -> call API
  const confirmPendingMove = async () => {
    if (!pendingMove) return;
    const { res, newStart, newEnd, newResource, dropInfo } = pendingMove;
    try {
      // prepare update payload; adapt to your backend
      const payload:any = { start_time: dayjs(newStart).toISOString() };
      if (newEnd) payload.end_time = dayjs(newEnd).toISOString();
      if (groupBy === 'location' && newResource) payload.location = Number(newResource);
      if (groupBy === 'employee' && newResource) payload.employee = Number(newResource);
      await reservationsService.update(res.id, payload);
      await loadReservations();
      setPendingMove(null);
    } catch (e) {
      console.error('Failed to save move', e);
      if (dropInfo) dropInfo.revert();
      setPendingMove(null);
    }
  };

  // quick actions in drawer
  const performAction = async (action:'check_in'|'in_service'|'complete'|'check_out') => {
    if (!selectedReservation) return;
    try {
      if (action === 'check_in') await reservationsService.checkIn(selectedReservation.id);
      if (action === 'in_service') await reservationsService.inService(selectedReservation.id);
      if (action === 'complete') await reservationsService.complete(selectedReservation.id);
      if (action === 'check_out') await reservationsService.checkOut(selectedReservation.id);
      await loadReservations();
      setDrawerOpen(false);
    } catch (e) { 
      console.error('Action failed', e); 
    }
  };

  return (
    <Box p={2}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center">
          <Typography variant="h5">Reservation Management</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={`Arrivals: ${kpi.arrivalsToday}`} />
            <Chip label={`Checked-in: ${kpi.checkedInNow}`} color="primary" />
            <Chip label={`In Service: ${kpi.inServiceNow}`} sx={{ bgcolor: '#f97316', color: '#fff' }} />
            <Chip label={`Revenue: $${kpi.revenueToday.toFixed(2)}`} color="success" />
          </Stack>
        </Stack>
      </Paper>

      <Box display="flex" gap={2} mb={2} alignItems="center">
        <Tabs value={tab} onChange={(_, v) => setTab(Number(v))}>
          <Tab label="Reservations" value={0} />
          <Tab label="Arrivals" value={1} />
          <Tab label="In Service" value={2} />
          <Tab label="Completed" value={3} />
          <Tab label="Calendar" value={4} />
        </Tabs>
        <Box flex={1} />
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>New Reservation</Button>
      </Box>

      {/* Filters & grouping controls (only shown above calendar) */}
      {tab === 4 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="booked">Booked</MenuItem>
                <MenuItem value="checked_in">Checked In</MenuItem>
                <MenuItem value="in_service">In Service</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Location</InputLabel>
              <Select value={locationFilter} label="Location" onChange={(e) => setLocationFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {locations.map(l => <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Employee</InputLabel>
              <Select value={employeeFilter} label="Employee" onChange={(e) => setEmployeeFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {employees.map(emp => <MenuItem key={emp.id} value={String(emp.id)}>{emp.full_name ?? `${emp.first_name} ${emp.last_name}`}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Guest" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} sx={{ minWidth: 120 }} />
            <TextField size="small" label="Service" value={serviceFilter} onChange={(e)=> setServiceFilter(e.target.value)} placeholder="Type service name" sx={{ minWidth: 120 }} />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Group by</InputLabel>
              <Select value={groupBy} label="Group by" onChange={(e) => setGroupBy(e.target.value as any)}>
                <MenuItem value={'none'}>None</MenuItem>
                <MenuItem value={'location'}>Location</MenuItem>
                <MenuItem value={'employee'}>Employee</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Show Timers</Typography>
              <Switch checked={showTimers} onChange={(e)=> setShowTimers(e.target.checked)} />
            </Stack>
          </Box>
        </Paper>
      )}

      {/* Calendar */}
      {tab === 4 ? (
        <Card>
          <CardContent>
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, resourceTimelinePlugin]}
              initialView={groupBy === 'none' ? 'timeGridDay' : 'resourceTimelineDay'}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,resourceTimelineDay' }}
              events={events}
              resources={resources}
              selectable={true}
              editable={true}
              eventClick={onEventClick}
              eventDrop={onEventDrop}
              eventContent={renderEventContent}
              height="auto"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography>Table views for other tabs (Reservations / Arrivals / In Service / Completed) — use the tables we discussed earlier.</Typography>
          </CardContent>
        </Card>
      )}

      {/* Drawer for reservation summary & quick actions */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 380, p: 2 }}>
          {selectedReservation ? (
            <>
              <Typography variant="h6">{selectedReservation.guest_name}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedReservation.location_name} — {selectedReservation.employee_name}</Typography>
              <Box mt={1}>
                <Chip label={(selectedReservation.status ?? 'pending').replace('_',' ')} sx={{ bgcolor: statusColor(selectedReservation.status), color: '#fff' }} />
              </Box>
              <Box mt={2}>
                <Typography variant="subtitle2">Services</Typography>
                <Typography>{(selectedReservation.reservation_services || []).map((s:any)=> s.service_details?.name || `#${s.service}`).join(', ') || 'No services'}</Typography>
                <Typography mt={1} variant="subtitle2">Notes</Typography>
                <Typography>{selectedReservation.notes || '—'}</Typography>
                <Typography mt={1} variant="subtitle2">Start / End</Typography>
                <Typography>{dayjs(selectedReservation.start_time).format('MMM D, YYYY h:mm A')} — {selectedReservation.end_time ? dayjs(selectedReservation.end_time).format('h:mm A') : '-'}</Typography>
                <Typography mt={1} variant="subtitle2">Total Price</Typography>
                <Typography>${Number(selectedReservation.total_price || 0).toFixed(2)}</Typography>
              </Box>

              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Button variant="contained" onClick={()=> performAction('check_in')} startIcon={<Check />} disabled={!(selectedReservation.status === 'confirmed' || !selectedReservation.status)}>Check-in</Button>
                <Button variant="contained" color="warning" onClick={()=> performAction('in_service')} startIcon={<DirectionsRun />} disabled={!(selectedReservation.status === 'checked_in')}>In Service</Button>
                <Button variant="contained" color="success" onClick={()=> performAction('complete')} startIcon={<DoneAll />} disabled={!(selectedReservation.status === 'in_service')}>Complete</Button>
                <Button variant="outlined" color="inherit" onClick={()=> performAction('check_out')} startIcon={<Logout />} disabled={!(selectedReservation.status === 'completed')}>Check-out</Button>
                <Button variant="text" onClick={()=> { setEditing(selectedReservation); setDrawerOpen(false); }}>Edit</Button>
              </Box>
            </>
          ) : (
            <Typography>No selection</Typography>
          )}
        </Box>
      </Drawer>

      {/* Confirmation dialog for drag-drop move */}
      <Dialog open={!!pendingMove} onClose={cancelPendingMove}>
        <DialogTitle>Confirm reschedule</DialogTitle>
        <DialogContent>
          {pendingMove && (
            <Box>
              <Typography>Move <strong>{pendingMove.res.guest_name}</strong></Typography>
              <Typography>From: {dayjs(pendingMove.oldStart).format('MMM D, h:mm A')} {pendingMove.oldResource ? ` (resource ${pendingMove.oldResource})` : ''}</Typography>
              <Typography>To: {dayjs(pendingMove.newStart).format('MMM D, h:mm A')} {pendingMove.newResource ? ` (resource ${pendingMove.newResource})` : ''}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelPendingMove}>Cancel</Button>
          <Button onClick={confirmPendingMove} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* New/Edit Reservation Form */}
      {(editing !== undefined) && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{editing ? 'Edit Reservation' : 'New Reservation'}</Typography>
            <ReservationBookingForm
              key={`rv-${formVersion}-${editing ? editing.id : 'new'}`}
              reservation={editing}
              onCreated={async () => {
                await loadReservations();
                setEditing(undefined);
                setFormVersion(v => v + 1);
              }}
              onSaved={async () => {
                await loadReservations();
                setEditing(undefined);
                setFormVersion(v => v + 1);
              }}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
};


