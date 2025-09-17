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

// NOTE: to run this file install:
// npm install @fullcalendar/react @fullcalendar/timegrid @fullcalendar/daygrid @fullcalendar/interaction @fullcalendar/resource-timeline dayjs @mui/material @mui/icons-material

// ------------------ Mock services (replace with your real API calls) ------------------
const reservationsService = {
  async list(params: any = {}) {
    // Return mock reservations (replace with API call)
    // params.start, params.end etc can be used to fetch server-side
    return [
      {
        id: 1,
        guest_name: 'John Doe',
        guest: 101,
        location: 1,
        location_name: 'Spa Room 1',
        employee: 10,
        employee_name: 'Anna',
        status: 'in_service',
        start_time: dayjs().subtract(20, 'minute').toISOString(),
        end_time: dayjs().add(40, 'minute').toISOString(),
        reservation_services: [{ service: 1, service_details: { name: 'Massage' } }],
        notes: 'VIP guest',
        total_price: 120,
      },
      {
        id: 2,
        guest_name: 'Jane Smith',
        guest: 102,
        location: 2,
        location_name: 'Spa Room 2',
        employee: 11,
        employee_name: 'Mike',
        status: 'booked',
        start_time: dayjs().add(30, 'minute').toISOString(),
        end_time: dayjs().add(90, 'minute').toISOString(),
        reservation_services: [{ service: 2, service_details: { name: 'Facial' } }],
        notes: '',
        total_price: 80,
      },
    ];
  },
  async update(id: number, data: any) {
    console.log('Mock update', id, data);
    return { success: true };
  },
  async checkIn(id: number) { console.log('checkIn', id); return {}; },
  async inService(id: number) { console.log('inService', id); return {}; },
  async complete(id: number) { console.log('complete', id); return {}; },
  async checkOut(id: number) { console.log('checkOut', id); return {}; },
};

const api = {
  async get(path: string) {
    if (path === '/locations/') return { data: [{ id: 1, name: 'Spa Room 1' }, { id: 2, name: 'Spa Room 2' }] };
    if (path === '/employees/') return { data: [{ id: 10, name: 'Anna' }, { id: 11, name: 'Mike' }] };
    return { data: [] };
  }
};

// ------------------ Helper: status color ------------------
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

// ------------------ Main Component ------------------
export default function ReservationManagement() {
  const [tab, setTab] = useState<number>(4); // 4 = Calendar tab by default
  const [reservations, setReservations] = useState<any[]>([]);
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
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);

  // KPI
  const [kpi, setKpi] = useState({ arrivalsToday: 0, checkedInNow: 0, inServiceNow: 0, revenueToday: 0 });

  useEffect(() => {
    (async () => {
      const loc = await api.get('/locations/').catch(() => ({ data: [] }));
      const emp = await api.get('/employees/').catch(() => ({ data: [] }));
      setLocations(loc.data ?? []);
      setEmployees(emp.data ?? []);
    })();
  }, []);

  const loadReservations = async (params: any = {}) => {
    setLoading(true);
    try {
      const data = await reservationsService.list(params);
      setReservations(Array.isArray(data) ? data : (data.results ?? data));
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally { setLoading(false); }
  };

  // initial load
  useEffect(() => { loadReservations(); }, []);

  // KPI compute
  useEffect(() => {
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    const arrivalsToday = reservations.filter(r => dayjs(r.start_time).isBetween(todayStart, todayEnd, null, '[]') && ['booked','confirmed','pending'].includes(r.status ?? 'pending')).length;
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
    .filter(r => !serviceFilter || (r.reservation_services || []).some((s:any) => (s.service_details?.name || '').toLowerCase() === serviceFilter.toLowerCase() || String(s.service) === serviceFilter))
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
  const resources = (groupBy === 'location' ? locations : groupBy === 'employee' ? employees : []).map((x:any) => ({ id: String(x.id), title: x.name }));

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
    if (r) { setSelectedReservation(r); setDrawerOpen(true); }
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
    } catch (e) { console.error('Action failed', e); }
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
        <Button variant="contained" startIcon={<Add />} onClick={() => {/* open new reservation dialog */}}>New Reservation</Button>
      </Box>

      {/* Filters & grouping controls (only shown above calendar) */}
      {tab === 4 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControl size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="booked">Booked</MenuItem>
                  <MenuItem value="checked_in">Checked In</MenuItem>
                  <MenuItem value="in_service">In Service</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl size="small">
                <InputLabel>Location</InputLabel>
                <Select value={locationFilter} label="Location" onChange={(e) => setLocationFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {locations.map(l => <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl size="small">
                <InputLabel>Employee</InputLabel>
                <Select value={employeeFilter} label="Employee" onChange={(e) => setEmployeeFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {employees.map(emp => <MenuItem key={emp.id} value={String(emp.id)}>{emp.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <TextField size="small" label="Guest" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} />
            </Grid>
            <Grid item>
              <TextField size="small" label="Service" value={serviceFilter} onChange={(e)=> setServiceFilter(e.target.value)} placeholder="Type service name" />
            </Grid>
            <Grid item>
              <FormControl size="small">
                <InputLabel>Group by</InputLabel>
                <Select value={groupBy} label="Group by" onChange={(e) => setGroupBy(e.target.value as any)}>
                  <MenuItem value={'none'}>None</MenuItem>
                  <MenuItem value={'location'}>Location</MenuItem>
                  <MenuItem value={'employee'}>Employee</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Show Timers</Typography>
                <Switch checked={showTimers} onChange={(e)=> setShowTimers(e.target.checked)} />
              </Stack>
            </Grid>
          </Grid>
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
              // no resize handler since user asked no resize confirmation
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
                <Button variant="contained" onClick={()=> performAction('check_in')} startIcon={<Check />} disabled={!(selectedReservation.status === 'booked' || selectedReservation.status === 'confirmed' || !selectedReservation.status)}>Check-in</Button>
                <Button variant="contained" color="warning" onClick={()=> performAction('in_service')} startIcon={<DirectionsRun />} disabled={!(selectedReservation.status === 'checked_in')}>In Service</Button>
                <Button variant="contained" color="success" onClick={()=> performAction('complete')} startIcon={<DoneAll />} disabled={!(selectedReservation.status === 'in_service')}>Complete</Button>
                <Button variant="outlined" color="inherit" onClick={()=> performAction('check_out')} startIcon={<Logout />} disabled={!(selectedReservation.status === 'completed')}>Check-out</Button>
                <Button variant="text" onClick={()=> { /* open edit form */ }}>Edit</Button>
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

    </Box>
  );
}
