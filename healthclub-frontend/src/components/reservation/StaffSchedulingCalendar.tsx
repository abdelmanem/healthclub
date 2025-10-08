import React from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayjs from 'dayjs';
import {
  Box,
  Drawer,
  Typography,
  Chip,
  Stack,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Popover,
  useTheme,
  Menu,
  MenuItem,
  Paper
} from '@mui/material';
import { ReservationBookingForm } from './ReservationBookingForm';
import { CancellationDialog } from './CancellationDialog';
import { api } from '../../services/api';
import { CalendarToday, ChevronLeft, ChevronRight, Today } from '@mui/icons-material';

type Reservation = {
  id: number;
  guest: number;
  guest_name: string;
  start_time: string;
  end_time: string;
  status: 'booked'|'checked_in'|'in_service'|'completed'|'cancelled';
  employee: number | null;
  is_first_for_guest?: boolean;
  reservation_services?: Array<{
    service: number;
    service_details?: { name?: string; duration_minutes?: number };
    service_duration_minutes?: number;
  }>;
};

type Employee = { id: number; name?: string; first_name?: string; last_name?: string };

const getEmployeeDisplayName = (e?: Employee | null) => {
  if (!e) return 'Unassigned';
  const full = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();
  return (e.name && e.name.length > 0) ? e.name : (full.length > 0 ? full : 'Staff');
};

const statusColor = (status?: string) => {
  switch (status) {
    case 'booked': return '#1976d2'; // blue
    case 'checked_in': return '#ed6c02'; // orange
    case 'in_service': return '#c56000'; // dark orange
    case 'completed': return '#2e7d32'; // green
    case 'cancelled': return '#d32f2f'; // red
    default: return '#0288d1';
  }
};

export const StaffSchedulingCalendar: React.FC = () => {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [drawer, setDrawer] = React.useState<{ open: boolean; reservation?: Reservation | null }>({ open: false, reservation: null });
  const [workingHours, setWorkingHours] = React.useState<{ start: string; end: string }>({ start: '10:00:00', end: '23:30:00' });
  const [calendarAnchor, setCalendarAnchor] = React.useState<null | HTMLElement>(null);
  const [monthlyReservations, setMonthlyReservations] = React.useState<Record<string, number>>({});
  const [localDate, setLocalDate] = React.useState(new Date());
  const theme = useTheme();
  const calendarRef = React.useRef<FullCalendar>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [weeklySchedules, setWeeklySchedules] = React.useState<Record<number, any[]>>({});
  const [backgroundBlocks, setBackgroundBlocks] = React.useState<any[]>([]);

  // Use local state for date management
  const selectedDate = localDate;
  const setSelectedDate = setLocalDate;
  // Backend now provides is_first_for_guest; no local heuristic needed
  const [createDialog, setCreateDialog] = React.useState<{ open: boolean; start?: string; employeeId?: number; locationId?: number }>({ open: false });
  const [menuAnchor, setMenuAnchor] = React.useState<{ element: HTMLElement; reservation: Reservation } | null>(null);
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = React.useState<boolean>(false);
  const [reservationToCancel, setReservationToCancel] = React.useState<number | null>(null);

  // Mini calendar helper functions
  const handleCalendarClick = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarAnchor(event.currentTarget);
    loadMonthlyReservations(selectedDate);
  };

  const handleCalendarClose = () => {
    setCalendarAnchor(null);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Update the FullCalendar to show the selected date
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(date);
    }
    handleCalendarClose();
  };

  const loadMonthlyReservations = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      const response = await api.get(`/reservations/?start_time__gte=${startDate}&start_time__lte=${endDate}`);
      const reservations = response.data.results || response.data || [];
      
      // Count reservations by date
      const counts: Record<string, number> = {};
      reservations.forEach((reservation: any) => {
        const reservationDate = new Date(reservation.start_time).toISOString().split('T')[0];
        counts[reservationDate] = (counts[reservationDate] || 0) + 1;
      });
      
      setMonthlyReservations(counts);
    } catch (error) {
      console.error('Failed to load monthly reservations:', error);
      setMonthlyReservations({});
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  // Mini calendar component
  const renderMiniCalendar = () => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDay = getFirstDayOfMonth(selectedDate);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Box key={`empty-${i}`} sx={{ 
          width: 32, 
          height: 32, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }} />
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isSelected = isSameDay(date, selectedDate);
      const isTodayDate = isToday(date);
      const dateString = date.toISOString().split('T')[0];
      const reservationCount = monthlyReservations[dateString] || 0;
      
      days.push(
        <Box
          key={day}
          onClick={() => handleDateSelect(date)}
          sx={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 1,
            fontSize: '0.875rem',
            fontWeight: isSelected ? 600 : 400,
            backgroundColor: isSelected ? theme.palette.primary.main : 'transparent',
            color: isSelected ? 'white' : isTodayDate ? theme.palette.primary.main : 'inherit',
            border: isTodayDate && !isSelected ? `1px solid ${theme.palette.primary.main}` : 'none',
            position: 'relative',
            '&:hover': {
              backgroundColor: isSelected ? theme.palette.primary.dark : theme.palette.action.hover,
            }
          }}
        >
          {day}
          {reservationCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isSelected ? 'white' : theme.palette.secondary.main,
                opacity: 0.8
              }}
            />
          )}
        </Box>
      );
    }
    
    return (
      <Box sx={{ p: 2, minWidth: 280 }}>
        {/* Month/Year Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <IconButton 
            size="small" 
            onClick={() => {
              const prevMonth = new Date(currentYear, currentMonth - 1, 1);
              setSelectedDate(prevMonth);
              if (calendarRef.current) {
                const calendarApi = calendarRef.current.getApi();
                calendarApi.gotoDate(prevMonth);
              }
              loadMonthlyReservations(prevMonth);
            }}
          >
            <ChevronLeft />
          </IconButton>
          
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {monthNames[currentMonth]} {currentYear}
          </Typography>
          
          <IconButton 
            size="small"
            onClick={() => {
              const nextMonth = new Date(currentYear, currentMonth + 1, 1);
              setSelectedDate(nextMonth);
              if (calendarRef.current) {
                const calendarApi = calendarRef.current.getApi();
                calendarApi.gotoDate(nextMonth);
              }
              loadMonthlyReservations(nextMonth);
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>
        
        {/* Day Names Header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, mb: 1 }}>
          {dayNames.map((dayName) => (
            <Box key={dayName} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: theme.palette.text.secondary
            }}>
              {dayName}
            </Box>
          ))}
        </Box>
        
        {/* Calendar Days */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
          {days}
        </Box>
        
        {/* Today Button */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            size="small" 
            onClick={() => {
              const today = new Date();
              setSelectedDate(today);
              if (calendarRef.current) {
                const calendarApi = calendarRef.current.getApi();
                calendarApi.gotoDate(today);
              }
              handleCalendarClose();
            }}
            startIcon={<Today />}
          >
            Today
          </Button>
        </Box>
      </Box>
    );
  };

  // const loadData = React.useCallback(async () => {
  //   setIsLoading(true);
  //   try {
  //     const dateStr = selectedDate.toISOString().split('T')[0];
  //     const [empRes, resRes] = await Promise.all([
  //       api.get('/employees/').catch(() => ({ data: { results: [] } })),
  //       api.get(`/reservations/?start_time__date=${dateStr}`).catch(() => ({ data: { results: [] } })),
  //     ]);
  //     const emp = (empRes.data.results ?? empRes.data ?? []) as Employee[];
  //     const res = (resRes.data.results ?? resRes.data ?? []) as Reservation[];
  //     setEmployees(emp);
  //     setReservations(res);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, [selectedDate]);
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Get the current view's date range from FullCalendar
      const calendarApi = calendarRef.current?.getApi();
      let startDate: string;
      let endDate: string;
      
      if (calendarApi) {
        const view = calendarApi.view;
        startDate = dayjs(view.activeStart).format('YYYY-MM-DD');
        endDate = dayjs(view.activeEnd).format('YYYY-MM-DD');
      } else {
        // Fallback: use selected date with buffer
        const start = dayjs(selectedDate).startOf('week');
        const end = dayjs(selectedDate).endOf('week');
        startDate = start.format('YYYY-MM-DD');
        endDate = end.format('YYYY-MM-DD');
      }
      
      const [empRes, resRes] = await Promise.all([
        api.get('/employees/').catch(() => ({ data: { results: [] } })),
        api.get(`/reservations/?start_time__gte=${startDate}&start_time__lte=${endDate}`).catch(() => ({ data: { results: [] } })),
      ]);
      
      const emp = (empRes.data.results ?? empRes.data ?? []) as Employee[];
      const res = (resRes.data.results ?? resRes.data ?? []) as Reservation[];
      setEmployees(emp);
      setReservations(res);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => { loadData(); }, [loadData]);

  // Load weekly schedules and compute background blocks whenever view or employees change
  React.useEffect(() => {
    const loadWeekly = async () => {
      try {
        const calendarApi = calendarRef.current?.getApi();
        const view = calendarApi?.view;
        const rangeStart = view ? new Date(view.activeStart) : new Date(selectedDate);
        // Compute local Sunday as effective_from
        const dow = rangeStart.getDay();
        const ws = new Date(rangeStart);
        ws.setDate(rangeStart.getDate() - dow);
        const ef = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;

        const [exactRes, nullRes] = await Promise.all([
          api.get('/employee-weekly-schedules/', { params: { effective_from: ef } }).catch(() => ({ data: [] })),
          api.get('/employee-weekly-schedules/', { params: { 'effective_from__isnull': 'true' } }).catch(() => ({ data: [] })),
        ]);
        const listA = exactRes.data.results ?? exactRes.data ?? [];
        const listB = nullRes.data.results ?? nullRes.data ?? [];
        const merged = [...listB, ...listA];
        const byEmp: Record<number, any[]> = {};
        for (const row of merged) {
          const empId = row.employee;
          if (!byEmp[empId]) byEmp[empId] = [];
          const existingIndex = byEmp[empId].findIndex((r: any) => r.day_of_week === row.day_of_week && (r.effective_from || null) === null && row.effective_from);
          if (existingIndex >= 0) {
            byEmp[empId][existingIndex] = row;
          } else {
            const hasExact = byEmp[empId].some((r: any) => r.day_of_week === row.day_of_week && !!r.effective_from);
            if (!(hasExact && !row.effective_from)) byEmp[empId].push(row);
          }
        }
        setWeeklySchedules(byEmp);

        // Build background blocks for off-hours/day-off per resource for current view range
        const blocks: any[] = [];
        const startDate = view ? new Date(view.activeStart) : new Date(selectedDate);
        const endDate = view ? new Date(view.activeEnd) : new Date(selectedDate);
        // iterate each day
        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
          const dowIdx = d.getDay();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dayStr = `${yyyy}-${mm}-${dd}`;
          for (const e of employees) {
            const rows = byEmp[e.id] || [];
            const row = rows.find((r: any) => Number(r.day_of_week) === dowIdx);
            const resourceId = String(e.id);
            if (!row) continue;
            if (row.is_day_off) {
              // Block entire day
              blocks.push({
                id: `off-${resourceId}-${dayStr}`,
                start: `${dayStr}T00:00:00`,
                end: `${dayStr}T23:59:59`,
                resourceIds: [resourceId],
                display: 'background',
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
              });
            } else {
              const start = row.start_time || '00:00';
              const end = row.end_time || '23:59';
              // Before shift
              if (start !== '00:00') {
                blocks.push({
                  id: `pre-${resourceId}-${dayStr}`,
                  start: `${dayStr}T00:00:00`,
                  end: `${dayStr}T${start}:00`,
                  resourceIds: [resourceId],
                  display: 'background',
                  backgroundColor: 'rgba(107, 114, 128, 0.15)',
                });
              }
              // After shift
              if (end !== '23:59') {
                blocks.push({
                  id: `post-${resourceId}-${dayStr}`,
                  start: `${dayStr}T${end}:00`,
                  end: `${dayStr}T23:59:59`,
                  resourceIds: [resourceId],
                  display: 'background',
                  backgroundColor: 'rgba(107, 114, 128, 0.15)',
                });
              }
            }
          }
        }
        setBackgroundBlocks(blocks);
      } catch (e) {
        console.warn('Failed to load schedules for background blocks', e);
        setWeeklySchedules({});
        setBackgroundBlocks([]);
      }
    };
    loadWeekly();
  }, [employees, selectedDate]);

  const isWithinEmployeeShift = React.useCallback((employeeId?: number | string | null, when?: Date) => {
    if (!employeeId || !when) return true;
    const empId = Number(employeeId);
    const rows = weeklySchedules[empId] || [];
    const dow = when.getDay();
    const row = rows.find((r: any) => Number(r.day_of_week) === dow);
    if (!row) return true;
    if (row.is_day_off) return false;
    const pad = (n: number) => String(n).padStart(2, '0');
    const current = `${pad(when.getHours())}:${pad(when.getMinutes())}`;
    const start = row.start_time || '00:00';
    const end = row.end_time || '23:59';
    return current >= start && current <= end;
  }, [weeklySchedules]);

  // Style the custom calendar button after the calendar renders
  React.useEffect(() => {
    const styleCalendarButton = () => {
      const button = document.querySelector('.fc-calendarIcon-button');
      if (button) {
        button.innerHTML = '📅';
        (button as HTMLElement).style.cssText = `
          background: #1976d2 !important;
          border: 1px solid #1976d2 !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          font-size: 16px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-width: 32px !important;
          height: 32px !important;
        `;
        const handleMouseEnter = () => {
          (button as HTMLElement).style.background = '#1565c0 !important';
        };
        const handleMouseLeave = () => {
          (button as HTMLElement).style.background = '#1976d2 !important';
        };
        button.addEventListener('mouseenter', handleMouseEnter);
        button.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          button.removeEventListener('mouseenter', handleMouseEnter);
          button.removeEventListener('mouseleave', handleMouseLeave);
        };
      }
      return undefined;
    };

    const cleanup = styleCalendarButton();
    return cleanup;
  }, []);

  const resources = employees.map((e) => ({ id: String(e.id), title: getEmployeeDisplayName(e) }));

  const events = reservations.map((r) => ({
    id: String(r.id),
    title: `${r.guest_name}`,
    start: r.start_time,
    end: r.end_time,
    resourceId: r.employee ? String(r.employee) : undefined,
    backgroundColor: statusColor(r.status),
    borderColor: statusColor(r.status),
    textColor: '#fff',
    extendedProps: {
      reservation: r,
      isFirst: !!r.is_first_for_guest,
      servicesText: (r.reservation_services || []).map((s: any) => {
        const name = s.service_details?.name || `Service #${s.service}`;
        const dur = s.service_duration_minutes || s.service_details?.duration_minutes;
        return dur ? `${name} (${dur}m)` : name;
      }).join(', '),
      totalDurationMin: (() => {
        const list = (r.reservation_services || []) as any[];
        const sum = list.reduce((acc, s) => acc + (s.service_duration_minutes || s.service_details?.duration_minutes || 0), 0);
        if (sum > 0) return sum;
        try {
          const diff = dayjs(r.end_time).diff(dayjs(r.start_time), 'minute');
          return isNaN(diff) ? undefined : diff;
        } catch { return undefined as any; }
      })(),
    },
  }));
  const allEvents = React.useMemo(() => {
    return [...backgroundBlocks, ...events];
  }, [backgroundBlocks, events]);

  const handleSelect = (info: any) => {
    const employeeId = info.resource?.id ? Number(info.resource.id) : undefined;
    const startDate: Date | undefined = info?.start ? new Date(info.start) : undefined;
    if (employeeId && startDate && !isWithinEmployeeShift(employeeId, startDate)) {
      window.alert('Cannot create a reservation on a day off or outside this employee\'s working hours.');
      return;
    }
    setCreateDialog({
      open: true,
      start: dayjs(info.start).toISOString(),
      employeeId,
      locationId: undefined,
    });
  };

  const handleEventDrop = async (dropInfo: any) => {
    const r: Reservation | undefined = dropInfo?.event?.extendedProps?.reservation;
    if (!r) return;
    
    try {
      const body: any = {
        start_time: dayjs(dropInfo.event.start).toISOString(),
        end_time: dayjs(dropInfo.event.end).toISOString(),
      };
      const resource = dropInfo.newResource || dropInfo.event.getResources?.()?.[0];
      
      // Update times first (employee may not be writable on reservation serializer)
      await api.patch(`/reservations/${r.id}/`, body);
      
      // If resource (employee) changed, use assignment endpoint
      if (resource) {
        const newEmployeeId = Number(resource.id);
        
        try {
          // Load existing assignments for this reservation (client-side filter for safety)
          const listResp = await api.get('/reservation-assignments/');
          const allAssignments = (listResp.data?.results ?? listResp.data ?? []) as Array<any>;
          
          const primaryForReservation = allAssignments.filter((a) => a.reservation === r.id && a.role_in_service === 'Primary Therapist');
          const existingPrimary = primaryForReservation[0];
          const targetPrimaryForNew = primaryForReservation.find((a) => a.employee === newEmployeeId);

          if (existingPrimary) {
            if (existingPrimary.employee === newEmployeeId) {
              // Already assigned to this employee; nothing to change
            } else if (targetPrimaryForNew) {
              // A primary assignment already exists for the new employee: remove the old one
              await api.delete(`/reservation-assignments/${existingPrimary.id}/`);
              // Keep targetPrimaryForNew as the current primary
            } else {
              // Switch employee on existing primary
              await api.patch(`/reservation-assignments/${existingPrimary.id}/`, { employee: newEmployeeId });
            }
          } else {
            // No primary yet: create one
            await api.post('/reservation-assignments/', {
              reservation: r.id,
              employee: newEmployeeId,
              role_in_service: 'Primary Therapist',
            });
          }
        } catch (assignErr: any) {
          console.error('Employee reassignment failed:', assignErr);
          const serverMsg = assignErr?.response?.data;
          try {
            const msg = typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg);
            window.alert(`Cannot reassign: ${msg}`);
          } catch {
            window.alert('Cannot reassign: validation failed (qualification/shift coverage or unique constraint).');
          }
          dropInfo.revert();
          return;
        }
      }
      
      await loadData();
    } catch (e) {
      console.error('Failed to update reservation', e);
      dropInfo.revert();
    }
  };

  const openDrawer = (r: Reservation) => setDrawer({ open: true, reservation: r });
  const closeDrawer = () => setDrawer({ open: false, reservation: null });

  const [isActing, setIsActing] = React.useState(false);

  const act = async (action: 'check_in'|'in_service'|'complete'|'cancel') => {
    if (isActing) return;
    const r = menuAnchor?.reservation || drawer.reservation;
    if (!r) return;
    if (action === 'cancel') {
      // Open cancellation dialog to collect reason
      setReservationToCancel(r.id);
      setIsCancellationDialogOpen(true);
      setMenuAnchor(null);
      return;
    }
    setIsActing(true);
    try {
      const endpoint = action === 'check_in' ? 'check-in' : action === 'in_service' ? 'in-service' : action === 'complete' ? 'complete' : 'cancel';
      await api.post(`/reservations/${r.id}/${endpoint}/`, {});
      await loadData();
      closeDrawer();
      setMenuAnchor(null);
    } catch (e) {
      console.error(e);
      alert(`Failed to ${action.replace('_', ' ')} reservation. Please try again.`);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimeGridPlugin as any, interactionPlugin]}
          initialView="resourceTimeGridDay"
          initialDate={selectedDate}
          resources={resources}
          events={allEvents}
          nowIndicator
          selectable
          selectMirror
          editable
          eventResourceEditable
          snapDuration="00:01:00"
          slotDuration="00:30:00"
          slotLabelInterval="00:30"
          slotLabelContent={(arg: any) => {
            const d = new Date(arg.date);
            const mins = d.getMinutes();
            if (mins === 30) return ':30';
            const hh = String(d.getHours()).padStart(2, '0');
            return `${hh}:00`;
          }}
          slotMinTime={workingHours.start}
          slotMaxTime={workingHours.end}
          headerToolbar={{ 
            left: 'prev,next calendarIcon today', 
            center: 'title', 
            right: 'resourceTimeGridDay,resourceTimeGridWeek' 
          }}
          customButtons={{
            calendarIcon: {
              text: '',
              click: (ev: MouseEvent, element: HTMLElement) => {
                setCalendarAnchor(element);
                loadMonthlyReservations(selectedDate);
              }
            }
          }}
          select={handleSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          eventClick={(arg:any) => {
            const r: Reservation | undefined = arg.event.extendedProps?.reservation;
            if (r) setMenuAnchor({ element: arg.el, reservation: r });
          }}
          eventDidMount={(info:any) => {
            try {
              info.el.style.border = '1px solid #000';
              info.el.style.boxShadow = 'none';
            } catch {}
          }}
          eventContent={(arg:any) => {
            const ev = arg.event;
            const start = ev.start ? dayjs(ev.start).format('h:mm A') : '';
            const end = ev.end ? dayjs(ev.end).format('h:mm A') : '';
            const title = ev.title || '';
            const isFirst = !!(ev.extendedProps && ev.extendedProps.isFirst);
            const servicesText = (ev.extendedProps && ev.extendedProps.servicesText) || '';
            const servicesLines = servicesText ? String(servicesText).split(', ') : [];
            const totalDurationMin = (ev.extendedProps && ev.extendedProps.totalDurationMin) as number | undefined;
            const badge = isFirst ? '<span style="margin-left:6px;padding:1px 4px;border-radius:3px;background:#fff;color:#000;font-size:10px;font-weight:700;">New</span>' : '';
            const servicesHtml = servicesLines.length > 0 ? `<div style=\"font-size:11px;opacity:.95;\">${servicesLines.map((line:any) => `<div>${line}</div>`).join('')}</div>` : '';
            const html = `
              <div style="padding:3px 4px;line-height:1.15;">
                <div style="font-size:11px;opacity:.95;">${start}</div>
                <div style="font-weight:700;font-size:12px;display:flex;align-items:center;">${title}${badge}</div>
                ${servicesHtml}
                ${typeof totalDurationMin === 'number' ? `<div style=\"font-size:11px;opacity:.95;\"><strong>Total Duration:</strong> ${totalDurationMin} min</div>` : ''}
                <div style="font-size:11px;opacity:.95;">${end}</div>
              </div>`;
            return { html };
          }}
          height="auto"
          datesSet={(dateInfo) => {
            // Update selected date when the calendar view changes
            setSelectedDate(dateInfo.start);
          }}
        />
      </Paper>

      <Drawer anchor="right" open={drawer.open} onClose={closeDrawer} sx={{ '& .MuiDrawer-paper': { width: 360 } }}>
        <Box p={2} display="flex" flexDirection="column" gap={2}>
          {drawer.reservation ? (
            <>
              <Box>
                <Typography variant="h6">{drawer.reservation.guest_name}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <Typography variant="body2">Staff:</Typography>
                  <Typography variant="body2">{getEmployeeDisplayName(employees.find(e => e.id === drawer.reservation?.employee) || null)}</Typography>
                </Stack>
                <Box mt={1}>
                  <Chip label={(drawer.reservation.status || '').replace('_',' ')} color={
                    drawer.reservation.status === 'booked' ? 'primary' :
                    drawer.reservation.status === 'checked_in' ? 'warning' :
                    drawer.reservation.status === 'in_service' ? 'warning' :
                    drawer.reservation.status === 'completed' ? 'success' :
                    drawer.reservation.status === 'cancelled' ? 'error' : 'default'
                  } size="small" />
                </Box>
                <Box mt={1}>
                  <Typography variant="body2">
                    {dayjs(drawer.reservation.start_time).format('MMM D, YYYY h:mm A')} – {dayjs(drawer.reservation.end_time).format('h:mm A')}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Stack spacing={1}>
                {drawer.reservation.status === 'booked' && (
                  <Button variant="contained" onClick={() => act('check_in')} disabled={isActing}>Check-in</Button>
                )}
                {drawer.reservation.status === 'checked_in' && (
                  <Button variant="contained" color="warning" onClick={() => act('in_service')} disabled={isActing}>Start Service</Button>
                )}
                {drawer.reservation.status === 'in_service' && (
                  <Button variant="contained" color="success" onClick={() => act('complete')} disabled={isActing}>Complete</Button>
                )}
                {drawer.reservation.status !== 'completed' && (
                  <Button variant="outlined" color="error" onClick={() => act('cancel')} disabled={isActing}>Cancel</Button>
                )}
              </Stack>
            </>
          ) : (
            <Typography variant="body2">No selection</Typography>
          )}
        </Box>
      </Drawer>

      <Dialog open={createDialog.open} onClose={() => setCreateDialog({ open: false })} maxWidth="md" fullWidth>
        <DialogTitle>New Reservation</DialogTitle>
        <DialogContent>
          <ReservationBookingForm
            onCreated={() => { setCreateDialog({ open: false }); loadData(); }}
            initialStart={createDialog.start}
            initialEmployeeId={createDialog.employeeId}
            initialLocationId={createDialog.locationId}
          />
        </DialogContent>
      </Dialog>

      {/* Mini Calendar Popover */}
      <Popover
        open={Boolean(calendarAnchor)}
        anchorEl={calendarAnchor}
        onClose={handleCalendarClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            mt: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        {renderMiniCalendar()}
      </Popover>

      {/* Context Menu for reservation actions */}
      <Menu
        aria-label="Reservation actions"
        anchorEl={menuAnchor?.element || null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem onClick={() => {
          const r = menuAnchor?.reservation;
          if (r) openDrawer(r);
          setMenuAnchor(null);
        }}>View Details</MenuItem>
        <Divider />
        {(() => {
          const status = menuAnchor?.reservation?.status;
          if (status === 'booked') return (<MenuItem onClick={() => act('check_in')} disabled={isActing}>Check-in Guest</MenuItem>);
          if (status === 'checked_in') return (<MenuItem onClick={() => act('in_service')} disabled={isActing}>Start Service</MenuItem>);
          if (status === 'in_service') return (<MenuItem onClick={() => act('complete')} disabled={isActing}>Mark Complete</MenuItem>);
          return null;
        })()}
        {menuAnchor?.reservation && menuAnchor.reservation.status !== 'completed' && menuAnchor.reservation.status !== 'cancelled' && [
          <Divider key="menu-divider-cancel" />,
          <MenuItem key="menu-item-cancel" onClick={() => act('cancel')} sx={{ color: 'error.main' }} disabled={isActing}>Cancel Reservation</MenuItem>
        ]}
      </Menu>

      {/* Cancellation Dialog */}
      <CancellationDialog
        open={isCancellationDialogOpen}
        onClose={() => setIsCancellationDialogOpen(false)}
        reservationId={reservationToCancel}
        onCancelled={async () => {
          await loadData();
          setIsCancellationDialogOpen(false);
          setReservationToCancel(null);
          closeDrawer();
        }}
      />
    </Box>
  );
};

export default StaffSchedulingCalendar;


