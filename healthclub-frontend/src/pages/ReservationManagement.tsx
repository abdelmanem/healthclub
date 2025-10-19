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
import { Add, Check, DirectionsRun, DoneAll, Logout, Edit, Cancel } from '@mui/icons-material';
import { InvoiceDetails } from '../components/pos/InvoiceDetails';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation } from '../services/reservations';
import { guestsService, Guest } from '../services/guests';
import { api } from '../services/api';
import { PageWrapper } from '../components/common/PageWrapper';
import { locationsApi, Location } from '../services/locations';
import { StaffSchedulingCalendar } from '../components/reservation/StaffSchedulingCalendar';
import { CancellationDialog } from '../components/reservation/CancellationDialog';

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
  const [weeklySchedules, setWeeklySchedules] = useState<Record<number, any[]>>({});

  // filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [groupBy] = useState<'location'|'employee'|'none'>('employee');
  const [showTimers] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [historicalReservations, setHistoricalReservations] = useState<Reservation[]>([]);
  const [guestDetails, setGuestDetails] = useState<Guest | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);

  // pending drag move
  const [pendingMove, setPendingMove] = useState<any | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'info'|'warning'|'error' }>({ open: false, message: '', severity: 'info' });
  // Dirty-room confirmation removed
  const [assignRoom, setAssignRoom] = useState<{ open: boolean; reservation?: Reservation; options: Location[]; selected?: Location | null }>({ open: false, reservation: undefined, options: [], selected: null });

  // KPI
  const [kpi, setKpi] = useState({ arrivalsToday: 0, checkedInNow: 0, inServiceNow: 0, revenueToday: 0 });

  // New reservation form
  const [editing, setEditing] = useState<Reservation | null | undefined>(undefined);
  const [formVersion, setFormVersion] = useState<number>(0);

  // Cancellation dialog
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState<boolean>(false);
  const [reservationToCancel, setReservationToCancel] = useState<number | null>(null);

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

  // Load employee weekly schedules for the current week window
  useEffect(() => {
    const loadWeeklySchedules = async () => {
      try {
        // Determine week start (Sunday) from current dateFilter in local time
        const ref = new Date(dateFilter);
        const dow = ref.getDay();
        const start = new Date(ref);
        start.setDate(ref.getDate() - dow);
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, '0');
        const dd = String(start.getDate()).padStart(2, '0');
        const weekStart = `${yyyy}-${mm}-${dd}`;

        // Fetch schedules effective for this week (either exact or null defaults)
        // First fetch those with this effective_from
        const [exactRes, nullRes] = await Promise.all([
          api.get('/employee-weekly-schedules/', { params: { effective_from: weekStart } }).catch(() => ({ data: [] })),
          api.get('/employee-weekly-schedules/', { params: { 'effective_from__isnull': 'true' } }).catch(() => ({ data: [] }))
        ]);
        const listA = exactRes.data.results ?? exactRes.data ?? [];
        const listB = nullRes.data.results ?? nullRes.data ?? [];
        // Prefer exact week over null defaults
        const merged = [...listB, ...listA];
        const byEmp: Record<number, any[]> = {};
        for (const row of merged) {
          const empId = row.employee;
          if (!byEmp[empId]) byEmp[empId] = [];
          // Ensure only one entry per day_of_week (exact overrides null)
          const existingIndex = byEmp[empId].findIndex((r: any) => r.day_of_week === row.day_of_week && (r.effective_from || null) === null && row.effective_from);
          if (existingIndex >= 0) {
            byEmp[empId][existingIndex] = row;
          } else {
            // Only push if not already present for that day with exact
            const hasExact = byEmp[empId].some((r: any) => r.day_of_week === row.day_of_week && !!r.effective_from);
            if (!(hasExact && !row.effective_from)) byEmp[empId].push(row);
          }
        }
        setWeeklySchedules(byEmp);
      } catch (e) {
        console.warn('Failed to load weekly schedules', e);
        setWeeklySchedules({});
      }
    };
    loadWeeklySchedules();
  }, [dateFilter]);

  const isWithinEmployeeShift = (employeeId: number | string | undefined, when: Date) => {
    if (!employeeId) return true; // if unknown, don't block
    const empIdNum = Number(employeeId);
    const rows = weeklySchedules[empIdNum] || [];
    const dow = when.getDay(); // 0..6
    const row = rows.find((r: any) => Number(r.day_of_week) === dow);
    if (!row) return true; // no data → allow
    if (row.is_day_off) return false;
    // compare local times HH:MM
    const pad = (n: number) => String(n).padStart(2, '0');
    const hh = pad(when.getHours());
    const mm = pad(when.getMinutes());
    const current = `${hh}:${mm}`;
    const start = row.start_time || '00:00';
    const end = row.end_time || '23:59';
    return current >= start && current <= end;
  };

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

  // Load guest details when a reservation is selected
  useEffect(() => {
    const guestId = selectedReservation?.guest;
    if (!guestId) {
      setGuestDetails(null);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const details = await guestsService.retrieve(guestId);
        if (!aborted) setGuestDetails(details);
      } catch (e) {
        console.error('Failed to load guest details', e);
        if (!aborted) setGuestDetails(null);
      }
    })();
    return () => { aborted = true; };
  }, [selectedReservation?.guest]);

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

  const resources = (groupBy === 'location' ? locations : groupBy === 'employee' ? employees : []).map((x:any, idx:number) => ({
    id: String(x.id),
    title: x.name,
    extendedProps: {
      index: idx + 1,
      altName: x.short_name || x.nickname || x.display_name || x.first_name || undefined,
    }
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
    const newResource = (dropInfo as any).newResource || (event as any).getResources?.()?.[0] || null;
    
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

      // Validate against employee weekly schedule when grouped by employee
      const targetEmployeeId = groupBy === 'employee' ? (newResource ? newResource.id : reservation?.employee) : reservation?.employee;
      const newStartDate = newStart.toDate();
      if (!isWithinEmployeeShift(targetEmployeeId, newStartDate)) {
        alert('Cannot schedule outside employee working hours or on a day off.');
        event.setStart(reservation.start_time);
        if (reservation.end_time) event.setEnd(reservation.end_time);
        setIsDragging(false);
        return;
      }

      // Update the reservation time
      await reservationsService.update(reservation.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });

      // If dragged to a different employee column, assign employee
      if (groupBy === 'employee' && newResource && String(reservation.employee || '') !== String(newResource.id)) {
        try {
          await api.post('/reservation-assignments/', {
            reservation: reservation.id,
            employee: Number(newResource.id),
            role_in_service: 'Primary Therapist',
          });
        } catch (assignErr) {
          console.warn('Employee assignment failed:', assignErr);
        }
      }

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
          if (data?.reason_code === 'room_occupied') {
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
        // Check out with automatic invoice creation
        const checkoutResult = await reservationsService.checkOut(targetReservation.id, {
          create_invoice: true,
          notes: 'Automatic invoice creation on checkout'
        });
        
        // If invoice was created, show it
        if (checkoutResult.invoice_created && checkoutResult.invoice_id) {
          setCreatedInvoiceId(checkoutResult.invoice_id);
          setInvoiceDialogOpen(true);
          
          setSnackbar({
            open: true,
            message: `Checked out. Invoice ${checkoutResult.invoice_number} created ($${checkoutResult.invoice_total}).`,
            severity: 'success',
          });
        } else {
          setSnackbar({
            open: true,
            message: 'Checked out. Room marked dirty and housekeeping task created.',
            severity: 'success',
          });
        }
        
        // Close the reservation drawer
        if (!reservation) setDrawerOpen(false);
      }
      await loadReservations();
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
    <PageWrapper title="">
      {/* Calendar only (full page) */}
      <Box sx={{ height: 'calc(100vh - 180px)' }}>
        <StaffSchedulingCalendar />
      </Box>

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

                {/* Primary Info */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 1, mb: 2 }}>
                  <Typography variant="body2"><strong>Guest:</strong> {selectedReservation.guest_name}</Typography>
                  <Typography variant="body2"><strong>Employee:</strong> {selectedReservation.employee_name || 'Unassigned'}</Typography>
                  <Typography variant="body2"><strong>Location:</strong> {selectedReservation.location_name || '—'}</Typography>
                  <Typography variant="body2"><strong>Status:</strong> {(selectedReservation.status ?? 'pending').replace('_',' ')}</Typography>
                  <Typography variant="body2"><strong>Reservation #:</strong> {selectedReservation.id}</Typography>
                  {(selectedReservation as any).is_first_for_guest && (
                    <Chip label="First-time Guest" color="info" size="small" sx={{ width: 'fit-content', mt: 0.5 }} />
                  )}
                </Box>

                {/* Services Table */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 1 }}>Services</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell align="right">Duration</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Subtotal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(selectedReservation.reservation_services || []).length ? (
                          (selectedReservation.reservation_services || []).map((s:any, i:number) => {
                            const name = s.service_details?.name || `#${s.service}`;
                            const dur = s.service_details?.duration_minutes || s.service_duration_minutes || 0;
                            const qty = s.quantity || 1;
                            const unit = Number(s.unit_price || s.service_details?.price || 0);
                            const subtotal = unit * qty;
                            return (
                              <TableRow key={i}>
                                <TableCell>{name}</TableCell>
                                <TableCell align="right">{dur} min</TableCell>
                                <TableCell align="right">{qty}</TableCell>
                                <TableCell align="right">${unit.toFixed(2)}</TableCell>
                                <TableCell align="right">${subtotal.toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5}>No services</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Total Duration</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedReservation.total_duration_minutes || 0} min</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total Price</Typography>
                    <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 700 }}>${Number(selectedReservation.total_price || 0).toFixed(2)}</Typography>
                  </Stack>
                </Box>

                {/* Schedule */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Schedule</Typography>
                  <Typography variant="body2">
                    {dayjs(selectedReservation.start_time).format('MMM D, YYYY h:mm A')} — {selectedReservation.end_time ? dayjs(selectedReservation.end_time).format('h:mm A') : 'TBD'}
                  </Typography>
                </Box>

                {/* Status Timeline */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 1 }}>Status Timeline</Typography>
                  <List dense>
                    {selectedReservation.checked_in_at && (
                      <ListItem><ListItemText primary="Checked in" secondary={dayjs(selectedReservation.checked_in_at as any).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                    {selectedReservation.in_service_at && (
                      <ListItem><ListItemText primary="In service" secondary={dayjs(selectedReservation.in_service_at as any).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                    {selectedReservation.completed_at && (
                      <ListItem><ListItemText primary="Completed" secondary={dayjs(selectedReservation.completed_at as any).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                    {(selectedReservation as any).checked_out_at && (
                      <ListItem><ListItemText primary="Checked out" secondary={dayjs((selectedReservation as any).checked_out_at).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                    {selectedReservation.cancelled_at && (
                      <ListItem><ListItemText primary="Cancelled" secondary={dayjs(selectedReservation.cancelled_at as any).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                    {(selectedReservation as any).no_show_recorded_at && (
                      <ListItem><ListItemText primary="No-show" secondary={dayjs((selectedReservation as any).no_show_recorded_at).format('MMM D, YYYY h:mm A')} /></ListItem>
                    )}
                  </List>
                </Box>

                {/* Notes / Flags */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'grey.600', mb: 0.5 }}>Notes</Typography>
                  <Typography variant="body2">{selectedReservation.notes || '—'}</Typography>
                </Box>

                {((selectedReservation as any).location_is_out_of_service) && (
                  <Chip label="Room Out of Service" color="error" size="small" />
                )}
              </Paper>

              {/* Guest Details */}
              {guestDetails && (
                <Paper sx={{ p: 3, mb: 3, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'grey.900' }}>Guest Details</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 0.75 }}>
                    <Typography variant="body2"><strong>Name:</strong> {guestDetails.first_name} {guestDetails.last_name}</Typography>
                    <Typography variant="body2"><strong>Email:</strong> <a href={`mailto:${guestDetails.email}`}>{guestDetails.email}</a></Typography>
                    <Typography variant="body2"><strong>Phone:</strong> <a href={`tel:${guestDetails.phone}`}>{guestDetails.phone}</a></Typography>
                    {guestDetails.membership_tier && (
                      <Typography variant="body2"><strong>Membership:</strong> {typeof guestDetails.membership_tier === 'string' ? guestDetails.membership_tier : (guestDetails.membership_tier as any)?.display_name || (guestDetails.membership_tier as any)?.name}</Typography>
                    )}
                    {guestDetails.loyalty_points !== undefined && (
                      <Typography variant="body2"><strong>Loyalty Points:</strong> {guestDetails.loyalty_points}</Typography>
                    )}
                    {guestDetails.visit_count !== undefined && (
                      <Typography variant="body2"><strong>Total Visits:</strong> {guestDetails.visit_count}</Typography>
                    )}
                    {guestDetails.total_spent !== undefined && (
                      <Typography variant="body2"><strong>Total Spent:</strong> ${Number(guestDetails.total_spent || 0).toFixed(2)}</Typography>
                    )}
                    {guestDetails.last_visit && (
                      <Typography variant="body2"><strong>Last Visit:</strong> {dayjs(guestDetails.last_visit).format('MMM D, YYYY')}</Typography>
                    )}
                  </Box>
                </Paper>
              )}

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
                  
                  {/* Cancel button - available for booked and checked_in statuses */}
                  {(selectedReservation.status === 'booked' || selectedReservation.status === 'checked_in') && (
                    <Button 
                      variant="outlined" 
                      color="error"
                      onClick={() => {
                        setReservationToCancel(selectedReservation.id);
                        setIsCancellationDialogOpen(true);
                      }}
                      startIcon={<Cancel />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Cancel Reservation
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

      {/* Dirty room confirmation removed */}

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

      {/* Cancellation Dialog */}
      <CancellationDialog
        open={isCancellationDialogOpen}
        onClose={() => setIsCancellationDialogOpen(false)}
        reservationId={reservationToCancel}
        onCancelled={async () => {
          await loadReservations();
          setSnackbar({ open: true, message: 'Reservation cancelled successfully', severity: 'success' });
          setDrawerOpen(false);
        }}
      />

      {/* Invoice Dialog */}
      <Dialog
        open={invoiceDialogOpen}
        onClose={() => {
          setInvoiceDialogOpen(false);
          setCreatedInvoiceId(null);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Invoice & Payment</Typography>
          <IconButton
            onClick={() => {
              setInvoiceDialogOpen(false);
              setCreatedInvoiceId(null);
            }}
            size="small"
          >
            <Cancel />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto' }}>
          {createdInvoiceId && (
            <InvoiceDetails
              invoiceId={createdInvoiceId}
              onClose={() => {
                setInvoiceDialogOpen(false);
                setCreatedInvoiceId(null);
              }}
              onPaymentProcessed={() => {
                loadReservations();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
};
