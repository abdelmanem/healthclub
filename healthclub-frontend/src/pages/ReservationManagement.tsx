import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Tabs,
  Tab,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  useTheme,
} from '@mui/material';
import { Add, Check, DirectionsRun, DoneAll, Logout, Edit } from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation } from '../services/reservations';
import { api } from '../services/api';
import { PageWrapper } from '../components/common/PageWrapper';
import { locationsApi, Location } from '../services/locations';

dayjs.extend(isBetween);

// Helper: status color
const statusColor = (status?: string) => {
  switch (status) {
    case 'booked': return 'primary.main';
    case 'checked_in': return 'warning.main';
    case 'in_service': return 'warning.dark';
    case 'completed': return 'success.main';
    case 'cancelled': return 'error.main';
    default: return 'info.main';
  }
};

export const ReservationManagement: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState<number>(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [groupBy] = useState<'location'|'employee'|'none'>('none');
  const [showTimers] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [historicalReservations, setHistoricalReservations] = useState<Reservation[]>([]);

  // pending drag move
  const [pendingMove, setPendingMove] = useState<any | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'info'|'warning'|'error' }>({ open: false, message: '', severity: 'info' });
  const [dirtyConfirm, setDirtyConfirm] = useState<{ open: boolean; reservation?: Reservation }>(() => ({ open: false }));
  const [assignRoom, setAssignRoom] = useState<{ open: boolean; reservation?: Reservation; options: Location[]; selected?: Location | null }>({ open: false, reservation: undefined, options: [], selected: null });

  // KPI
  const [kpi, setKpi] = useState({ arrivalsToday: 0, checkedInNow: 0, inServiceNow: 0, revenueToday: 0 });

  // New reservation form
  const [editing, setEditing] = useState<Reservation | null | undefined>(undefined);
  const [formVersion, setFormVersion] = useState<number>(0);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  const loadReservations = async () => {
    try {
      const data = await reservationsService.list();
      setReservations(Array.isArray(data) ? data : ((data as any).results ?? data));
    } catch (e) {
      console.error('Failed to load reservations', e);
    }
  };

  const loadHistoricalReservations = async (guestId: number) => {
    try {
      const data = await reservationsService.list({ guest: guestId });
      const allReservations = Array.isArray(data) ? data : ((data as any).results ?? data);
      // Filter out the current reservation and only show completed/cancelled ones
      const historical = allReservations.filter((r: Reservation) => 
        r.id !== selectedReservation?.id && 
        ['completed', 'cancelled'].includes(r.status ?? '')
      );
      setHistoricalReservations(historical);
    } catch (e) {
      console.error('Failed to load historical reservations', e);
      setHistoricalReservations([]);
    }
  };

  useEffect(() => { loadReservations(); }, []);

  // KPI
  useEffect(() => {
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    const arrivalsToday = reservations.filter(r =>
      dayjs(r.start_time).isBetween(todayStart, todayEnd, null, '[]') &&
      r.status === 'booked'
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

  // keep ticking for timers
  useEffect(() => {
    if (tab !== 5 || !showTimers) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tab, showTimers]);

  // Get filtered reservations
  const getFilteredReservations = () => {
    return reservations
      .filter(r => !statusFilter || (r.status ?? '').toString() === statusFilter)
      .filter(r => !locationFilter || String(r.location) === locationFilter)
      .filter(r => !employeeFilter || String(r.employee) === employeeFilter)
      .filter(r => !guestSearch || (r.guest_name ?? '').toLowerCase().includes(guestSearch.toLowerCase()))
      .filter(r => !dateFilter || dayjs(r.start_time).format('YYYY-MM-DD') === dateFilter);
  };

  // Get calendar events (without date filter for calendar view)
  const getCalendarEvents = () => {
    return reservations
      .filter(r => !statusFilter || (r.status ?? '').toString() === statusFilter)
      .filter(r => !locationFilter || String(r.location) === locationFilter)
      .filter(r => !employeeFilter || String(r.employee) === employeeFilter)
      .filter(r => !guestSearch || (r.guest_name ?? '').toLowerCase().includes(guestSearch.toLowerCase()));
  };

  // map reservations -> calendar events
  const events = getCalendarEvents().map(r => ({
    id: String(r.id),
    title: `${r.guest_name ?? 'Guest'}`,
    start: r.start_time,
    end: r.end_time,
    backgroundColor: r.status === 'booked' ? theme.palette.primary.main :
                     r.status === 'checked_in' ? theme.palette.warning.main :
                     r.status === 'in_service' ? theme.palette.warning.dark :
                     r.status === 'completed' ? theme.palette.success.main :
                     r.status === 'cancelled' ? theme.palette.error.main : theme.palette.info.main,
    borderColor: theme.palette.common.white,
    textColor: theme.palette.common.white,
    extendedProps: { reservation: r, status: r.status, locationId: r.location, employeeId: r.employee },
    resourceId: groupBy === 'location' ? String(r.location) : (groupBy === 'employee' ? String(r.employee) : undefined),
    editable: true,
  }));

  const resources = (groupBy === 'location' ? locations : groupBy === 'employee' ? employees : []).map((x:any) => ({
    id: String(x.id),
    title: x.name
  }));

  const renderEventContent = (arg:any) => {
    const ev:any = arg.event;
    const props = ev.extendedProps || {};
    const reservation = props.reservation;
    const status = props.status;
    const start = ev.start ? ev.start.getTime() : null;
    
    // Calculate duration from services
    let durationText = '';
    if (reservation) {
      if (reservation.total_duration_minutes) {
        durationText = `${reservation.total_duration_minutes}min`;
      } else if (reservation.reservation_services && reservation.reservation_services.length > 0) {
        const totalDuration = reservation.reservation_services.reduce((total: number, service: any) => {
          return total + (service.service_duration_minutes || service.service_details?.duration_minutes || 0);
        }, 0);
        durationText = `${totalDuration}min`;
      }
    }
    
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
        {durationText && <div style={{ fontSize: 10, opacity: 0.8 }}>{durationText}</div>}
        {timerNode}
      </div>
    );
  };

  const onEventClick = async (clickInfo:any) => {
    const r = clickInfo.event.extendedProps?.reservation;
    if (r) {
      setSelectedReservation(r);
      setDrawerOpen(true);
      // Load historical reservations for this guest
      if (r.guest) {
        await loadHistoricalReservations(r.guest);
      }
      // Auto-suggest reassignment if room is out of service
      if ((r as any).location_is_out_of_service) {
        try {
          const gender = (r as any).guest_gender || undefined;
          const params: any = { is_clean: 'true', is_occupied: 'false' };
          if (gender === 'male' || gender === 'female') params.gender = `${gender},unisex`;
          const rooms = await locationsApi.list(params);
          // Ensure current room is present in options and preselect it
          const currentRoomId = r.location as any;
          const hasCurrent = rooms.some((loc: any) => loc.id === currentRoomId);
          const options = hasCurrent ? rooms : ([...rooms, { id: currentRoomId, name: r.location_name, is_clean: (r as any).location_is_clean, is_occupied: (r as any).location_is_occupied }] as any);
          const selected = options.find((loc: any) => loc.id === currentRoomId) || null;
          setAssignRoom({ open: true, reservation: r, options, selected });
        } catch {
          setAssignRoom({ open: true, reservation: r, options: [], selected: null });
        }
      }
    }
  };

  const onEventDrop = async (dropInfo: any) => {
    const event = dropInfo.event;
    const reservation = event.extendedProps?.reservation;
    
    if (!reservation) return;

    setIsDragging(true);
    
    try {
      // Calculate duration based on service duration, not original end time
      let totalDurationMinutes = 0;
      
      if (reservation.total_duration_minutes) {
        // Use the total duration from the reservation
        totalDurationMinutes = reservation.total_duration_minutes;
      } else if (reservation.reservation_services && reservation.reservation_services.length > 0) {
        // Calculate from individual services
        totalDurationMinutes = reservation.reservation_services.reduce((total: number, service: any) => {
          return total + (service.service_duration_minutes || service.service_details?.duration_minutes || 0);
        }, 0);
      } else {
        // Fallback to original duration if no service info available
        const originalStart = dayjs(reservation.start_time);
        const originalEnd = dayjs(reservation.end_time);
        totalDurationMinutes = originalEnd.diff(originalStart, 'minutes');
      }
      
      const newStart = dayjs(event.start);
      const newEnd = newStart.add(totalDurationMinutes, 'minutes');

      // Update the reservation
      await reservationsService.update(reservation.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });

      // Reload reservations to reflect changes
      await loadReservations();
      
      // Show success feedback
      console.log(`Reservation for ${reservation.guest_name} moved to ${newStart.format('MMM D, h:mm A')} (${totalDurationMinutes} min duration)`);
    } catch (error) {
      console.error('Failed to update reservation time:', error);
      
      // Revert the event position on error
      event.setStart(reservation.start_time);
      if (reservation.end_time) {
        event.setEnd(reservation.end_time);
      }
      
      // Show error feedback
      alert('Failed to update reservation time. Please try again.');
    } finally {
      setIsDragging(false);
    }
  };

  // Note: onEventResize is disabled since duration should be fixed based on service time
  // const onEventResize = async (resizeInfo: any) => {
  //   // Duration changes are not allowed - duration is fixed by service requirements
  //   console.log('Duration changes are not allowed - duration is fixed by service requirements');
  // };

  const performAction = async (action:'check_in'|'in_service'|'complete'|'check_out', reservation?: Reservation) => {
    const targetReservation = reservation || selectedReservation;
    if (!targetReservation) return;
    try {
      if (action === 'check_in') {
        try {
          await reservationsService.checkIn(targetReservation.id);
        } catch (err: any) {
          const data = err?.response?.data || {};
          if (data?.reason_code === 'room_dirty' && data?.requires_confirmation) {
            setDirtyConfirm({ open: true, reservation: targetReservation });
            return;
          } else if (data?.reason_code === 'room_occupied') {
            setSnackbar({ open: true, message: 'Room is occupied. Choose another room.', severity: 'warning' });
            return;
          } else if ((data?.error || '').toLowerCase().includes('out of service')) {
            setSnackbar({ open: true, message: 'Room is out of service. Please reassign.', severity: 'warning' });
            try {
              const gender = (targetReservation as any).guest_gender || undefined;
              const params: any = { is_clean: 'true', is_occupied: 'false' };
              if (gender === 'male' || gender === 'female') params.gender = `${gender},unisex`;
              const rooms = await locationsApi.list(params);
              setAssignRoom({ open: true, reservation: targetReservation, options: rooms });
            } catch {
              setAssignRoom({ open: true, reservation: targetReservation, options: [] });
            }
            return;
          } else {
            throw err;
          }
        }
      }
      if (action === 'in_service') await reservationsService.inService(targetReservation.id);
      if (action === 'complete') await reservationsService.complete(targetReservation.id);
      if (action === 'check_out') {
        await reservationsService.checkOut(targetReservation.id);
        // Auto-create invoice on checkout (non-blocking UI)
        try { await reservationsService.createInvoice(targetReservation.id); } catch (e) { console.warn('Invoice creation failed:', e); }
        // Notify user about room status change and HK task creation
        setSnackbar({ open: true, message: 'Checked out. Room marked dirty and housekeeping task created.', severity: 'success' });
      }
      await loadReservations();
      if (!reservation) setDrawerOpen(false);
    } catch (e:any) {
      console.error('Action failed', e);
      setSnackbar({ open: true, message: e?.response?.data?.detail || 'Action failed', severity: 'error' });
    }
  };

  // Table renderer for tabs
  const renderTable = (rows: Reservation[]) => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Guest</TableCell>
            <TableCell>Location</TableCell>
            <TableCell>Employee</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>End</TableCell>
            <TableCell>Total Price</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.guest_name}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{r.location_name}</span>
                  {(r as any).location_is_out_of_service && (
                    <Chip label="OOS" color="error" size="small" />
                  )}
                </Stack>
              </TableCell>
              <TableCell>{r.employee_name}</TableCell>
              <TableCell>
                <Chip 
                  label={r.status} 
                  color={r.status === 'booked' ? 'primary' : 
                         r.status === 'checked_in' ? 'warning' :
                         r.status === 'in_service' ? 'warning' :
                         r.status === 'completed' ? 'success' :
                         r.status === 'cancelled' ? 'error' : 'info'}
                />
              </TableCell>
              <TableCell>{dayjs(r.start_time).format('MMM D, h:mm A')}</TableCell>
              <TableCell>{r.end_time ? dayjs(r.end_time).format('h:mm A') : '-'}</TableCell>
              <TableCell>${Number(r.total_price || 0).toFixed(2)}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <IconButton size="small" onClick={async () => { 
                    setSelectedReservation(r); 
                    setDrawerOpen(true);
                    if (r.guest) {
                      await loadHistoricalReservations(r.guest);
                    }
                  }}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={async () => {
                    try {
                      const gender = (r as any).guest_gender || undefined;
                      const params: any = { is_clean: 'true', is_occupied: 'false' };
                      if (gender === 'male' || gender === 'female') params.gender = `${gender},unisex`;
                      const rooms = await locationsApi.list(params);
                      // Ensure current room is present in options and preselect it
                      const currentRoomId = r.location as any;
                      const hasCurrent = rooms.some((loc: any) => loc.id === currentRoomId);
                      const options = hasCurrent ? rooms : ([...rooms, { id: currentRoomId, name: r.location_name, is_clean: (r as any).location_is_clean, is_occupied: (r as any).location_is_occupied }] as any);
                      const selected = options.find((loc: any) => loc.id === currentRoomId) || null;
                      setAssignRoom({ open: true, reservation: r, options, selected });
                    } catch {
                      setAssignRoom({ open: true, reservation: r, options: [], selected: null });
                    }
                  }} title="Assign Room">
                    <DirectionsRun fontSize="small" />
                  </IconButton>
                  {r.status === 'booked' && (
                    <IconButton size="small" onClick={() => performAction('check_in', r)} color="primary" title="Check-in">
                      <Check fontSize="small" />
                    </IconButton>
                  )}
                  {r.status === 'checked_in' && (
                    <IconButton size="small" onClick={() => performAction('in_service', r)} color="warning" title="Start Service">
                      <DirectionsRun fontSize="small" />
                    </IconButton>
                  )}
                  {r.status === 'in_service' && (
                    <IconButton size="small" onClick={() => performAction('complete', r)} color="success" title="Complete Service">
                      <DoneAll fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <PageWrapper
      title="Reservation Management"
      subtitle="Manage reservations, check-ins, and service schedules"
      actions={
        <Stack direction="row" spacing={1}>
          <Chip label={`Today's Arrivals: ${kpi.arrivalsToday}`} />
          <Chip label={`Checked-in: ${kpi.checkedInNow}`} color="primary" />
          <Chip label={`In Service: ${kpi.inServiceNow}`} sx={{ bgcolor: 'warning.dark', color: 'warning.contrastText' }} />
          <Chip label={`Revenue: $${kpi.revenueToday.toFixed(2)}`} color="success" />
        </Stack>
      }
    >

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="booked">Booked</MenuItem>
                <MenuItem value="checked_in">Checked In</MenuItem>
                <MenuItem value="in_service">In Service</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="checked_out">Checked Out</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Location</InputLabel>
              <Select
                value={locationFilter}
                label="Location"
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={String(loc.id)}>{loc.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Employee</InputLabel>
              <Select
                value={employeeFilter}
                label="Employee"
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.id} value={String(emp.id)}>{emp.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              sx={{ minWidth: 200 }}
              size="small"
              label="Guest Search"
              value={guestSearch}
              onChange={(e) => setGuestSearch(e.target.value)}
              placeholder="Search by guest name..."
            />
            <TextField
              sx={{ minWidth: 150 }}
              size="small"
              label="Date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="outlined"
              onClick={() => {
                setStatusFilter('');
                setLocationFilter('');
                setEmployeeFilter('');
                setGuestSearch('');
                setDateFilter(dayjs().format('YYYY-MM-DD'));
              }}
            >
              Clear Filters
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box display="flex" gap={2} mb={2} alignItems="center">
        <Tabs value={tab} onChange={(_, v) => setTab(Number(v))}>
          <Tab label="Reservations" value={0} />
          <Tab label="Arrivals" value={1} />
          <Tab label="In Service" value={2} />
          <Tab label="Completed" value={3} />
          <Tab label="Housekeeping" value={4} />
          <Tab label="Calendar" value={5} />
        </Tabs>
        <Box flex={1} />
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>New Reservation</Button>
      </Box>

      {/* Table views */}
      {tab === 0 && renderTable(getFilteredReservations())}
      {tab === 1 && renderTable(getFilteredReservations().filter(r => r.status === 'booked'))}
      {tab === 2 && renderTable(getFilteredReservations().filter(r => r.status === 'in_service'))}
      {tab === 3 && renderTable(getFilteredReservations().filter(r => r.status === 'completed'))}
      {tab === 4 && (
        <Box>
          <Typography variant="h6" gutterBottom>Housekeeping Tasks</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Housekeeping tasks are automatically created when guests check out. 
            Use the dedicated Housekeeping page for task management.
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => window.location.href = '/housekeeping'}
            sx={{ mt: 2 }}
          >
            Go to Housekeeping Management
          </Button>
        </Box>
      )}

      {/* Calendar */}
      {tab === 5 && (
        <Card>
          <CardContent sx={{ position: 'relative' }}>
            {isDragging && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  borderRadius: 1,
                }}
              >
                <Typography variant="h6" color="primary">
                  Updating reservation...
                </Typography>
              </Box>
            )}
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, resourceTimelinePlugin]}
              initialView={groupBy === 'none' ? 'timeGridDay' : 'resourceTimelineDay'}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,resourceTimelineDay' }}
              events={events}
              resources={resources}
              slotDuration="00:30:00"
              slotLabelInterval="00:30"
              slotLabelContent={(arg: any) => {
                const d = new Date(arg.date);
                const mins = d.getMinutes();
                if (mins === 30) return ':30';
                // Top of the hour: show HH:00 in 12-hour with leading zero
                const rawHour = d.getHours();
                const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
                const hh = String(hour12).padStart(2, '0');
                return `${hh}:00`;
              }}
              selectable={true}
              editable={true}
              eventStartEditable={true}
              eventDurationEditable={false}
              eventClick={onEventClick}
              eventDrop={onEventDrop}
              eventContent={renderEventContent}
              height="auto"
            />
          </CardContent>
        </Card>
      )}

      {/* Drawer for reservation summary */}
      <Drawer 
        anchor="right" 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 420,
            background: theme.palette.background.content,
            borderLeft: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          },
        }}
      >
        <Box sx={{ 
          width: '100%', 
          height: '100%', 
          p: 3,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {selectedReservation ? (
            <>
              {/* Header */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: 'grey.900', mb: 1 }}>
                  {selectedReservation.guest_name}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedReservation.location_name} • {selectedReservation.employee_name}
                </Typography>
                <Chip 
                  label={(selectedReservation.status ?? 'pending').replace('_',' ')} 
                  color={selectedReservation.status === 'booked' ? 'primary' : 
                         selectedReservation.status === 'checked_in' ? 'warning' :
                         selectedReservation.status === 'in_service' ? 'warning' :
                         selectedReservation.status === 'completed' ? 'success' :
                         selectedReservation.status === 'cancelled' ? 'error' : 'info'}
                  sx={{ 
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }} 
                />
              </Box>

              {/* Details Card */}
              <Paper sx={{ p: 3, mb: 3, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'grey.900' }}>Reservation Details</Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Services</Typography>
                  <Typography variant="body2">
                    {(selectedReservation.reservation_services || []).map((s:any)=> s.service_details?.name || `#${s.service}`).join(', ') || 'No services'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Notes</Typography>
                  <Typography variant="body2">{selectedReservation.notes || '—'}</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Schedule</Typography>
                  <Typography variant="body2">
                    {dayjs(selectedReservation.start_time).format('MMM D, YYYY h:mm A')} — {selectedReservation.end_time ? dayjs(selectedReservation.end_time).format('h:mm A') : 'TBD'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Total Price</Typography>
                  <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 600 }}>
                    ${Number(selectedReservation.total_price || 0).toFixed(2)}
                  </Typography>
                </Box>

                {((selectedReservation as any).location_is_out_of_service) && (
                  <Chip label="Room Out of Service" color="error" size="small" />
                )}
              </Paper>

              {/* Action Buttons */}
              <Paper sx={{ p: 2, mb: 3, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'grey.900' }}>Actions</Typography>
                <Stack spacing={1}>
                  {selectedReservation.status === 'booked' && (
                    <Button 
                      variant="contained" 
                      onClick={()=> performAction('check_in')} 
                      startIcon={<Check />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Check-in
                    </Button>
                  )}
                  {selectedReservation.status === 'checked_in' && (
                    <Button 
                      variant="contained" 
                      color="warning" 
                      onClick={()=> performAction('in_service')} 
                      startIcon={<DirectionsRun />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Start Service
                    </Button>
                  )}
                  {selectedReservation.status === 'in_service' && (
                    <Button 
                      variant="contained" 
                      color="success" 
                      onClick={()=> performAction('complete')} 
                      startIcon={<DoneAll />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Complete Service
                    </Button>
                  )}
                  {selectedReservation.status === 'completed' && (
                    <Button 
                      variant="outlined" 
                      color="inherit" 
                      onClick={()=> performAction('check_out')} 
                      startIcon={<Logout />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Check-out
                    </Button>
                  )}
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Button 
                    variant="outlined" 
                    onClick={()=> { setEditing(selectedReservation); setDrawerOpen(false); }}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Edit Reservation
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    onClick={async ()=> {
                      if (!selectedReservation) return;
                      // Load clean & vacant rooms (and unisex or matching gender)
                      try {
                        const gender = (selectedReservation as any).guest_gender || undefined;
                        const params: any = { is_clean: 'true', is_occupied: 'false' };
                        if (gender === 'male' || gender === 'female') params.gender = `${gender},unisex`;
                        // If services exist, filter to locations linked to those services
                        const serviceIds = (selectedReservation.reservation_services || []).map((s:any) => s.service).filter(Boolean);
                        if (serviceIds.length > 0) (params as any).services = serviceIds.join(',');
                        const rooms = await locationsApi.list(params);
                        // Ensure current room is present in options and preselect it
                        const currentRoomId = selectedReservation.location as any;
                        const hasCurrent = rooms.some((loc: any) => loc.id === currentRoomId);
                        const options = hasCurrent ? rooms : ([...rooms, { id: currentRoomId, name: selectedReservation.location_name, is_clean: (selectedReservation as any).location_is_clean, is_occupied: (selectedReservation as any).location_is_occupied }] as any);
                        const selected = options.find((loc: any) => loc.id === currentRoomId) || null;
                        setAssignRoom({ open: true, reservation: selectedReservation, options, selected });
                      } catch {
                        setAssignRoom({ open: true, reservation: selectedReservation, options: [], selected: null });
                      }
                    }}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Assign Room
                  </Button>
                </Stack>
              </Paper>

              {/* Historical Reservations */}
              {historicalReservations.length > 0 && (
                <Paper sx={{ p: 2, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)' }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'grey.900' }}>
                    Historical Reservations ({historicalReservations.length})
                  </Typography>
                  <List dense>
                    {historicalReservations.slice(0, 5).map((reservation) => (
                      <ListItem key={reservation.id} sx={{ px: 0 }}>
                        <ListItemText
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">
                                {dayjs(reservation.start_time).format('MMM D, YYYY')}
                              </Typography>
                              <Chip 
                                label={reservation.status} 
                                size="small"
                                color={reservation.status === 'booked' ? 'primary' : 
                                       reservation.status === 'checked_in' ? 'warning' :
                                       reservation.status === 'in_service' ? 'warning' :
                                       reservation.status === 'completed' ? 'success' :
                                       reservation.status === 'cancelled' ? 'error' : 'info'}
                                sx={{ 
                                  fontSize: '0.7rem',
                                  height: 20
                                }} 
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {dayjs(reservation.start_time).format('h:mm A')} - {reservation.end_time ? dayjs(reservation.end_time).format('h:mm A') : 'TBD'}
                              </Typography>
                              <br />
                              <Typography variant="caption" color="text.secondary">
                                ${Number(reservation.total_price || 0).toFixed(2)} • {reservation.location_name}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                    {historicalReservations.length > 5 && (
                      <ListItem sx={{ px: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          ... and {historicalReservations.length - 5} more
                        </Typography>
                      </ListItem>
                    )}
                  </List>
                </Paper>
              )}
            </>
          ) : (
            <Typography>No selection</Typography>
          )}
        </Box>
      </Drawer>

      {/* Confirmation dialog for drag-drop (optional, can be expanded later) */}
      <Dialog open={!!pendingMove} onClose={() => setPendingMove(null)}>
        <DialogTitle>Confirm reschedule</DialogTitle>
        <DialogContent>
          <Typography>Move reservation?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingMove(null)}>Cancel</Button>
          <Button onClick={() => setPendingMove(null)} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Dirty room confirmation */}
      <Dialog open={dirtyConfirm.open} onClose={() => setDirtyConfirm({ open: false })}>
        <DialogTitle>Room is Dirty</DialogTitle>
        <DialogContent>
          <Typography>The selected room is marked dirty. Do you want to proceed with check-in anyway?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDirtyConfirm({ open: false })}>Cancel</Button>
          <Button 
            onClick={async () => {
              const r = dirtyConfirm.reservation || selectedReservation;
              setDirtyConfirm({ open: false });
              if (!r) return;
              try {
                await reservationsService.checkIn(r.id, { allow_dirty: true });
                await loadReservations();
                setSnackbar({ open: true, message: 'Checked in (room dirty acknowledged)', severity: 'success' });
              } catch (e:any) {
                setSnackbar({ open: true, message: e?.response?.data?.detail || 'Check-in failed', severity: 'error' });
              }
            }}
            variant="contained"
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* New/Edit form dialog */}
      <Dialog 
        open={editing !== undefined} 
        onClose={() => setEditing(undefined)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editing ? 'Edit Reservation' : 'New Reservation'}</DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(undefined)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Room Dialog */}
      <Dialog open={assignRoom.open} onClose={() => setAssignRoom({ open: false, reservation: undefined, options: [], selected: null })}>
        <DialogTitle>Assign Room</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Autocomplete
            options={assignRoom.options}
            getOptionLabel={(o: Location) => `${o.name} ${o.is_clean ? '' : '(Dirty)'} ${o.is_occupied ? '(Occupied)' : ''}`.trim()}
            value={assignRoom.selected || (assignRoom.options.find((o:any) => o.id === assignRoom.reservation?.location) || null)}
            onChange={(_, value) => {
              setAssignRoom(prev => ({ ...prev, selected: (value as any) || null }));
            }}
            renderInput={(params) => <TextField {...params} label="Room" sx={{ minWidth: 320 }} />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignRoom({ open: false, reservation: undefined, options: [], selected: null })}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            const r = assignRoom.reservation;
            const selected: any = assignRoom.selected;
            if (!r || !selected) return;
            try {
              await reservationsService.update(r.id, { location: selected.id } as any);
              await loadReservations();
              setAssignRoom({ open: false, reservation: undefined, options: [], selected: null });
              setSnackbar({ open: true, message: `Assigned ${selected.name}`, severity: 'success' });
            } catch (e:any) {
              setSnackbar({ open: true, message: e?.response?.data?.detail || 'Failed to assign room', severity: 'error' });
            }
          }}>Assign</Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
};
