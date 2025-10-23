import React from 'react';
import FullCalendar from '@fullcalendar/react';
// @ts-ignore
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';
import { ReservationBookingForm } from './ReservationBookingForm';
import { CancellationDialog } from './CancellationDialog';
import { api } from '../../services/api';
import { 
  ChevronLeft, 
  ChevronRight, 
  Today, 
  Cancel,
  Event,
  Person,
  Schedule,
  CheckCircle,
  Phone,
  Email as EmailIcon,
  LocationOn,
  LocalActivity,
  AccessTime,
  AttachMoney,
  Star,
  Visibility,
  Payment,
  AccountBalance,
  Receipt,
  CreditCard,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { guestsService } from '../../services/guests';
import { reservationsService } from '../../services/reservations';
import { EditGuestDialog } from '../guest/EditGuestDialog';
import { InvoiceDetails } from '../pos/InvoiceDetails';
import { ReservationDepositForm } from './ReservationDepositForm';
import { RefundDialog } from './RefundDialog';

type Reservation = {
  id: number;
  guest: number;
  guest_name: string;
  start_time: string;
  end_time: string;
  status: 'booked'|'checked_in'|'in_service'|'completed'|'cancelled'|'checked_out';
  employee: number | null;
  employee_name?: string;
  location?: number | null;
  location_name?: string;
  is_first_for_guest?: boolean;
  reservation_services?: Array<{
    service: number;
    service_details?: { name?: string; duration_minutes?: number; price?: string };
    quantity?: number;
    unit_price?: string;
    service_duration_minutes?: number;
  }>;
  total_duration_minutes?: number;
  total_price?: number;
  checked_in_at?: string | null;
  in_service_at?: string | null;
  completed_at?: string | null;
  checked_out_at?: string | null;
  cancelled_at?: string | null;
  no_show_recorded_at?: string | null;
  // guest membership information
  guest_membership_tier?: string | { name: string; display_name: string };
  guest_loyalty_points?: number;
  // deposit fields
  deposit_required?: boolean;
  deposit_amount?: string;
  deposit_paid?: boolean;
  deposit_paid_at?: string | null;
  deposit_status?: 'not_required' | 'pending' | 'paid';
  can_pay_deposit?: boolean;
};

type Employee = { id: number; name?: string; first_name?: string; last_name?: string };

const getEmployeeDisplayName = (e?: Employee | null) => {
  if (!e) return 'Unassigned';
  const full = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();
  return (e.name && e.name.length > 0) ? e.name : (full.length > 0 ? full : 'Staff');
};

const getMembershipTierDisplay = (tier?: string | { name: string; display_name: string } | null) => {
  if (!tier) return null;
  if (typeof tier === 'string') return tier;
  return tier.display_name || tier.name;
};

const getMembershipTierColor = (tier?: string | { name: string; display_name: string } | null) => {
  const tierName = getMembershipTierDisplay(tier)?.toLowerCase();
  switch (tierName) {
    case 'platinum': return '#94a3b8';
    case 'gold': return '#fbbf24';
    case 'silver': return '#9ca3af';
    case 'bronze': return '#fb923c';
    case 'vip': return '#a855f7';
    default: return '#6b7280';
  }
};

const statusColor = (status?: string) => {
  switch (status) {
    case 'booked': return '#3b82f6'; // blue
    case 'checked_in': return '#f59e0b'; // amber
    case 'in_service': return '#8b5cf6'; // purple
    case 'completed': return '#10b981'; // green
    case 'cancelled': return '#ef4444'; // red
    default: return '#6366f1';
  }
};

const statusGradient = (status?: string) => {
  switch (status) {
    case 'booked': return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    case 'checked_in': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    case 'in_service': return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
    case 'completed': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    case 'cancelled': return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    default: return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
  }
};

export const StaffSchedulingCalendar: React.FC = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const navigate = useNavigate();
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [drawer, setDrawer] = React.useState<{ open: boolean; reservation?: Reservation | null }>({ open: false, reservation: null });
  const [calendarAnchor, setCalendarAnchor] = React.useState<null | HTMLElement>(null);
  const [monthlyReservations, setMonthlyReservations] = React.useState<Record<string, number>>({});
  const [localDate, setLocalDate] = React.useState(new Date());
  const theme = useTheme();
  const calendarRef = React.useRef<FullCalendar>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [weeklySchedules, setWeeklySchedules] = React.useState<Record<number, any[]>>({});
  const [backgroundBlocks, setBackgroundBlocks] = React.useState<any[]>([]);
  const [selectedGuest, setSelectedGuest] = React.useState<any | null>(null);
  const [isEditGuestOpen, setIsEditGuestOpen] = React.useState(false);
  const [editDialog, setEditDialog] = React.useState<{ open: boolean; reservation?: Reservation | null }>({ open: false, reservation: null });

  const openEditReservation = async (reservationId: number) => {
    try {
      const full = await reservationsService.retrieve(reservationId as any);
      setEditDialog({ open: true, reservation: full as any });
    } catch (e) {
      console.error('Failed to load reservation for edit', e);
      if (drawer.reservation) setEditDialog({ open: true, reservation: drawer.reservation });
    }
  };

  const selectedDate = localDate;
  const setSelectedDate = setLocalDate;
  const [createDialog, setCreateDialog] = React.useState<{ open: boolean; start?: string; employeeId?: number; locationId?: number }>({ open: false });
  const [menuAnchor, setMenuAnchor] = React.useState<{ element: HTMLElement; reservation: Reservation } | null>(null);
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = React.useState<boolean>(false);
  const [reservationToCancel, setReservationToCancel] = React.useState<number | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = React.useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = React.useState<number | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = React.useState<boolean>(false);
  const [refundDialogOpen, setRefundDialogOpen] = React.useState<boolean>(false);
  const [reservationToRefund, setReservationToRefund] = React.useState<Reservation | null>(null);

  const handleCalendarClose = () => {
    setCalendarAnchor(null);
  };

  const handleRefundProcessed = async () => {
    setRefundDialogOpen(false);
    setReservationToRefund(null);
    
    // After refund is processed, proceed with cancellation
    if (reservationToRefund) {
      setReservationToCancel(reservationToRefund.id);
      setIsCancellationDialogOpen(true);
    }
    
    await loadData(); // Refresh calendar data
    if (drawer.reservation) {
      // Re-fetch the specific reservation to update the drawer
      try {
        const updated = (await api.get(`/reservations/${drawer.reservation.id}/`)).data;
        setDrawer({ open: true, reservation: updated });
      } catch {
        // ignore refresh errors
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
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
    
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Box key={`empty-${i}`} sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      );
    }
    
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
            background: isSelected ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: isSelected ? 'white' : isTodayDate ? '#667eea' : 'inherit',
            border: isTodayDate && !isSelected ? '2px solid #667eea' : 'none',
            position: 'relative',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: isSelected ? 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)' : 'rgba(102, 126, 234, 0.1)',
              transform: 'scale(1.05)',
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
                background: isSelected ? 'white' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                opacity: 0.9,
                boxShadow: '0 0 4px rgba(0,0,0,0.2)'
              }}
            />
          )}
        </Box>
      );
    }
    
    return (
      <Box sx={{ p: 3, minWidth: 320, background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
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
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              '&:hover': { background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)' }
            }}
          >
            <ChevronLeft />
          </IconButton>
          
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
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
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              '&:hover': { background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)' }
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
          {dayNames.map((dayName) => (
            <Box key={dayName} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.5px'
            }}>
              {dayName}
            </Box>
          ))}
        </Box>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {days}
        </Box>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
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
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              px: 3,
              py: 1,
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)',
              }
            }}
          >
            Today
          </Button>
        </Box>
      </Box>
    );
  };

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const calendarApi = calendarRef.current?.getApi();
      let startDate: string;
      let endDate: string;
      
      if (calendarApi) {
        const view = calendarApi.view;
        startDate = dayjs(view.activeStart).format('YYYY-MM-DD');
        endDate = dayjs(view.activeEnd).format('YYYY-MM-DD');
      } else {
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

  // Update employee availability styling when date changes
  React.useEffect(() => {
    const updateEmployeeStyling = () => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return;

      // Get the current view date
      const view = calendarApi.view;
      const currentDate = view ? new Date(view.activeStart) : selectedDate;

      // Update resource styling for current date
      employees.forEach(employee => {
        const isAvailable = isWithinEmployeeShift(employee.id, currentDate);
        const resourceEl = document.querySelector(`[data-resource-id="${employee.id}"]`);
        if (resourceEl) {
          if (isAvailable) {
            resourceEl.classList.remove('employee-day-off');
          } else {
            resourceEl.classList.add('employee-day-off');
          }
        }
      });
    };

    // Small delay to ensure calendar is rendered
    const timeoutId = setTimeout(updateEmployeeStyling, 100);
    return () => clearTimeout(timeoutId);
  }, [selectedDate, employees, weeklySchedules]);

  React.useEffect(() => {
    const loadWeekly = async () => {
      try {
        const calendarApi = calendarRef.current?.getApi();
        const view = calendarApi?.view;
        const rangeStart = view ? new Date(view.activeStart) : new Date(selectedDate);
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

        const blocks: any[] = [];
        const startDate = view ? new Date(view.activeStart) : new Date(selectedDate);
        const endDate = view ? new Date(view.activeEnd) : new Date(selectedDate);
        const toHms = (t: string | null | undefined, fallback: string) => {
          if (!t) return fallback;
          const parts = String(t).split(':');
          if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
          if (parts.length >= 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
          return fallback;
        };
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
              blocks.push({
                id: `off-${resourceId}-${dayStr}`,
                start: `${dayStr}T00:00:00`,
                end: `${dayStr}T23:59:59`,
                resourceIds: [resourceId],
                display: 'background',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
              });
            } else {
              const start = toHms(row.start_time, '00:00:00');
              const end = toHms(row.end_time, '23:59:59');
              if (start !== '00:00:00') {
                blocks.push({
                  id: `pre-${resourceId}-${dayStr}`,
                  start: `${dayStr}T00:00:00`,
                  end: `${dayStr}T${start}`,
                  resourceIds: [resourceId],
                  display: 'background',
                  backgroundColor: 'rgba(148, 163, 184, 0.08)',
                });
              }
              if (end !== '23:59:59') {
                blocks.push({
                  id: `post-${resourceId}-${dayStr}`,
                  start: `${dayStr}T${end}`,
                  end: `${dayStr}T23:59:59`,
                  resourceIds: [resourceId],
                  display: 'background',
                  backgroundColor: 'rgba(148, 163, 184, 0.08)',
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

  const handleDatesSet = (dateInfo: any) => {
    setSelectedDate(dateInfo.start);
  };

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

  const resources = employees.map((e) => {
    const isAvailableToday = isWithinEmployeeShift(e.id, selectedDate);
    const displayName = getEmployeeDisplayName(e);
    const titleWithStatus = isAvailableToday 
      ? displayName 
      : `${displayName} (Day Off)`;
    
    return { 
      id: String(e.id), 
      title: titleWithStatus,
      eventColor: isAvailableToday ? undefined : '#e5e7eb', // Gray for unavailable
      extendedProps: {
        isAvailable: isAvailableToday,
        isDayOff: !isAvailableToday
      }
    };
  });

  React.useEffect(() => {
    const styleCalendarButton = () => {
      const button = document.querySelector('.fc-calendarIcon-button');
      if (button) {
        button.innerHTML = '📅';
        (button as HTMLElement).style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          border: none !important;
          color: white !important;
          border-radius: 8px !important;
          padding: 6px 12px !important;
          font-size: 18px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-width: 40px !important;
          height: 40px !important;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
          transition: all 0.3s ease !important;
        `;
        const handleMouseEnter = () => {
          (button as HTMLElement).style.background = 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%) !important';
          (button as HTMLElement).style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5) !important';
          (button as HTMLElement).style.transform = 'translateY(-2px) !important';
        };
        const handleMouseLeave = () => {
          (button as HTMLElement).style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important';
          (button as HTMLElement).style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4) !important';
          (button as HTMLElement).style.transform = 'translateY(0) !important';
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
      membershipTier: r.guest_membership_tier,
      loyaltyPoints: r.guest_loyalty_points,
    },
  }));

  // Build 10-minute cleanup buffer events following each reservation's end_time.
  const cleanupEvents = reservations
    .filter((r) => !!r.end_time)
    .map((r) => {
      const start = dayjs(r.end_time);
      const end = start.add(10, 'minute');
      return {
        id: `cleanup-${r.id}`,
        title: 'Room Cleanup',
        start: start.toISOString(),
        end: end.toISOString(),
        resourceId: r.employee ? String(r.employee) : undefined,
        // Distinct color (teal) with readable text
        backgroundColor: '#14b8a6', // teal-500
        borderColor: '#14b8a6',
        textColor: '#ffffff',
        editable: false,
        eventResizableFromStart: false,
        extendedProps: {
          isCleanup: true,
          baseReservationId: r.id,
          cleanupMinutes: 10,
        },
      } as any;
    });
  
  const allEvents = React.useMemo(() => {
    return [...backgroundBlocks, ...events, ...cleanupEvents];
  }, [backgroundBlocks, events, cleanupEvents]);

  const handleSelect = (info: any) => {
    const employeeId = info.resource?.id ? Number(info.resource.id) : undefined;
    const startDate: Date | undefined = info?.start ? new Date(info.start) : undefined;
    if (employeeId && startDate && !isWithinEmployeeShift(employeeId, startDate)) {
      // Get employee name for better error message
      const employee = employees.find(e => e.id === employeeId);
      const employeeName = employee ? getEmployeeDisplayName(employee) : 'Employee';
      window.alert(`Cannot create a reservation for ${employeeName} - they are scheduled for a day off or outside their working hours.`);
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
    
    // Prevent dragging checked_out reservations
    if (r.status === 'checked_out') {
      window.alert("Cannot move reservation: This reservation has been checked out and completed.");
      dropInfo.revert();
      return;
    }
    
    // Prevent dragging cancelled reservations
    if (r.status === 'cancelled') {
      window.alert("Cannot move reservation: This reservation has been cancelled.");
      dropInfo.revert();
      return;
    }
    
    try {
      const newStartDate: Date | null = dropInfo?.event?.start ? new Date(dropInfo.event.start) : null;
      const newEndDate: Date | null = dropInfo?.event?.end ? new Date(dropInfo.event.end) : null;
      const resource = dropInfo.newResource || dropInfo.event.getResources?.()?.[0];
      const targetEmployeeId = resource ? Number(resource.id) : (r.employee ?? null);
      
      // Only validate if we're changing to a different employee
      if (targetEmployeeId && targetEmployeeId !== r.employee && newStartDate) {
        const startOk = isWithinEmployeeShift(targetEmployeeId, newStartDate);
        const endOk = newEndDate ? isWithinEmployeeShift(targetEmployeeId, newEndDate) : true;
        
        if (!startOk || !endOk) {
          const employee = employees.find(e => e.id === targetEmployeeId);
          const employeeName = employee ? getEmployeeDisplayName(employee) : 'Unknown Employee';
          
          // Check if it's specifically a day off
          const isDayOff = !isWithinEmployeeShift(targetEmployeeId, newStartDate);
          const message = isDayOff 
            ? `Cannot move reservation: ${employeeName} is scheduled for a day off on this date.`
            : `Cannot move reservation: outside ${employeeName}'s working hours.`;
          
          window.alert(message);
          dropInfo.revert();
          return;
        }
      }

      const body: any = {
        start_time: dayjs(dropInfo.event.start).toISOString(),
        end_time: dayjs(dropInfo.event.end).toISOString(),
      };
      const resource2 = dropInfo.newResource || dropInfo.event.getResources?.()?.[0];
      
      await api.patch(`/reservations/${r.id}/`, body);
      
      if (resource2) {
        const newEmployeeId = Number(resource2.id);
        
        try {
          const listResp = await api.get('/reservation-assignments/');
          const allAssignments = (listResp.data?.results ?? listResp.data ?? []) as Array<any>;
          
          const primaryForReservation = allAssignments.filter((a) => a.reservation === r.id && a.role_in_service === 'Primary Therapist');
          const existingPrimary = primaryForReservation[0];
          const targetPrimaryForNew = primaryForReservation.find((a) => a.employee === newEmployeeId);

          if (existingPrimary) {
            if (existingPrimary.employee === newEmployeeId) {
              // Already assigned
            } else if (targetPrimaryForNew) {
              await api.delete(`/reservation-assignments/${existingPrimary.id}/`);
            } else {
              await api.patch(`/reservation-assignments/${existingPrimary.id}/`, { employee: newEmployeeId });
            }
          } else {
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
            window.alert('Cannot reassign: validation failed.');
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

  const openDrawer = (r: Reservation) => {
    setDrawer({ open: true, reservation: r });
    if (r?.guest) {
      setSelectedGuest(null);
      (async () => {
        try {
          const g = await guestsService.retrieve(r.guest);
          setSelectedGuest(g as any);
        } catch (e) {
          console.error('Failed to load guest', e);
          setSelectedGuest({
            first_name: r.guest_name?.split(' ')[0] ?? 'Guest',
            last_name: r.guest_name?.split(' ').slice(1).join(' ') ?? '',
            email: '',
            phone: ''
          } as any);
        }
      })();
    }
  };
  const closeDrawer = () => setDrawer({ open: false, reservation: null });

  const [isActing, setIsActing] = React.useState(false);

  const act = async (action: 'check_in'|'in_service'|'complete'|'check_out'|'cancel') => {
    if (isActing) return;
    const r = menuAnchor?.reservation || drawer.reservation;
    if (!r) return;
    if (action === 'cancel') {
      // Check if reservation has a prepaid deposit that needs refunding
      if (r.deposit_required && r.deposit_paid && r.deposit_amount) {
        setReservationToRefund(r);
        setRefundDialogOpen(true);
        setMenuAnchor(null);
        return;
      }
      
      // No deposit to refund, proceed with normal cancellation
      setReservationToCancel(r.id);
      setIsCancellationDialogOpen(true);
      setMenuAnchor(null);
      return;
    }
    setIsActing(true);
    try {
      if (action === 'check_out') {
        const checkoutResult = await reservationsService.checkOut(r.id, {
          create_invoice: true,
          notes: 'Checkout from calendar'
        });
        
        if (checkoutResult.invoice_created && checkoutResult.invoice_id) {
          setCreatedInvoiceId(checkoutResult.invoice_id);
          setInvoiceDialogOpen(true);
          
          alert(
            `Check-out successful!\n\n` +
            `Invoice created: ${checkoutResult.invoice_number}\n` +
            `Total: ${checkoutResult.invoice_total}\n` +
            `Housekeeping task created automatically.`
          );
        } else {
          try {
            const invoiceResult = await reservationsService.createInvoice(r.id);
            
            if (invoiceResult.invoice_id) {
              setCreatedInvoiceId(invoiceResult.invoice_id);
              setInvoiceDialogOpen(true);
              
              let message = `Check-out successful!\n\n` +
                `Invoice created: ${invoiceResult.invoice_number}\n` +
                `Total: $${invoiceResult.total_amount}\n` +
                `Balance Due: $${invoiceResult.balance_due}\n`;
              
              if (invoiceResult.deposits_applied_count > 0) {
                message += `\nDeposits Applied: ${invoiceResult.deposits_applied_count}\n` +
                  `Deposit Amount: $${invoiceResult.amount_paid}\n`;
              }
              
              message += `\nHousekeeping task created automatically.`;
              
              alert(message);
            } else {
              alert('Check-out successful! Housekeeping task created automatically.');
            }
          } catch (invoiceError) {
            console.error('Failed to create invoice manually:', invoiceError);
            alert('Check-out successful! Housekeeping task created automatically.');
          }
        }
      } else {
        const endpoint = action === 'check_in' ? 'check-in' : action === 'in_service' ? 'in-service' : action === 'complete' ? 'complete' : 'cancel';
        await api.post(`/reservations/${r.id}/${endpoint}/`, {});
      }
      
      await loadData();
      closeDrawer();
      setMenuAnchor(null);
    } catch (e: any) {
      console.error(e);
      const errorMessage = e?.response?.data?.error || e?.response?.data?.message || `Failed to ${action.replace('_', ' ')} reservation.`;
      alert(errorMessage);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}
        >
          Staff Scheduling
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 500 }}>
          Manage appointments and staff schedules
        </Typography>
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: 4, 
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          '& .fc': {
            fontFamily: 'inherit',
          },
          '& .fc-theme-standard th': {
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderColor: '#e2e8f0',
            fontWeight: 600,
            color: '#475569',
            padding: '12px 8px',
          },
          '& .fc-theme-standard td': {
            borderColor: '#e2e8f0',
          },
          '& .fc-col-header-cell': {
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            fontWeight: 600,
            color: '#475569',
          },
          '& .fc-timegrid-slot': {
            height: '40px',
          },
          '& .fc-timegrid-slot-label': {
            fontWeight: 500,
            color: '#64748b',
          },
          '& .fc-event': {
            borderRadius: '6px',
            border: 'none !important',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              transform: 'translateY(-1px)',
            }
          },
          '& .fc-button': {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            textTransform: 'none',
            padding: '8px 16px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)',
            },
            '&:disabled': {
              opacity: 0.5,
              cursor: 'not-allowed',
            },
            '&:focus': {
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            }
          },
          '& .fc-button-primary:not(:disabled).fc-button-active': {
            background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
          },
          '& .fc-toolbar-title': {
            fontSize: '1.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textFillColor: 'transparent',
          },
          // Style for inactive employee columns
    '& .fc-resource': {
      '&[data-resource-id]': {
        '&.employee-day-off': {
          opacity: 0.4,
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          position: 'relative',
          cursor: 'not-allowed !important',
          '&::before': {
            content: '"🚫"',
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '18px',
            zIndex: 10,
            background: 'rgba(239, 68, 68, 0.9)',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          },
          '& .fc-resource-cell': {
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%) !important',
            color: '#9ca3af !important',
            borderColor: '#d1d5db !important',
            fontWeight: 500,
            cursor: 'not-allowed !important',
            position: 'relative',
            '&::after': {
              content: '"DAY OFF"',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#ef4444',
              background: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #ef4444',
              zIndex: 5,
            }
          },
          '& .fc-timegrid-slot': {
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%) !important',
            borderColor: '#e5e7eb !important',
            cursor: 'not-allowed !important',
            '&:hover': {
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%) !important',
            }
          },
          '& .fc-timegrid-slot-label': {
            color: '#9ca3af !important',
          },
          '& .fc-timegrid-slot-minor': {
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%) !important',
            cursor: 'not-allowed !important',
          },
          '& .fc-event': {
            cursor: 'not-allowed !important',
            pointerEvents: 'none',
            opacity: '0.3 !important',
          }
        }
      }
    },
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimeGridPlugin as any, interactionPlugin]}
          initialView="resourceTimeGridDay"
          initialDate={selectedDate}
          // timeZone="Africa/Cairo"
          resources={resources}
          events={allEvents}
          nowIndicator
          selectable
          selectMirror
          editable
          eventResourceEditable
          eventAllow={(dropInfo: any, draggedEvent: any) => {
            // Prevent dragging checked_out and cancelled reservations
            const reservation = draggedEvent.extendedProps?.reservation;
            if (reservation && (reservation.status === 'checked_out' || reservation.status === 'cancelled')) {
              return false;
            }
            return true;
          }}
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
          slotMinTime="00:00:00"
          slotMaxTime="23:59:59"
          scrollTime="06:00:00"
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
          eventDrop={(dropInfo: any) => {
            // Prevent dragging cleanup events
            if (dropInfo?.event?.extendedProps?.isCleanup) {
              dropInfo.revert();
              return;
            }
            handleEventDrop(dropInfo);
          }}
          eventResize={(resizeInfo: any) => {
            // Prevent resizing cleanup events
            if (resizeInfo?.event?.extendedProps?.isCleanup) {
              resizeInfo.revert();
              return;
            }
            handleEventDrop(resizeInfo);
          }}
          eventClick={(arg:any) => {
            const r: Reservation | undefined = arg.event.extendedProps?.reservation;
            if (r) setMenuAnchor({ element: arg.el, reservation: r });
          }}
          eventDidMount={(info:any) => {
            try {
              info.el.style.border = 'none';
              info.el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              
              // Add visual indication for non-draggable reservations
              const reservation = info.event.extendedProps?.reservation;
              if (reservation && (reservation.status === 'checked_out' || reservation.status === 'cancelled')) {
                info.el.style.cursor = 'not-allowed';
                info.el.style.opacity = '0.7';
                const tooltipText = reservation.status === 'checked_out' 
                  ? 'This reservation has been checked out and cannot be moved'
                  : 'This reservation has been cancelled and cannot be moved';
                info.el.title = tooltipText;
              }
            } catch {}
          }}
          resourceLaneDidMount={(info: any) => {
            // Apply styling to inactive employee columns
            const resourceId = info.resource.id;
            const employee = employees.find(e => String(e.id) === resourceId);
            if (employee) {
              // Get the actual date from the calendar view
              const calendarApi = calendarRef.current?.getApi();
              const view = calendarApi?.view;
              const currentDate = view ? new Date(view.activeStart) : selectedDate;
              
              if (!isWithinEmployeeShift(employee.id, currentDate)) {
                info.el.classList.add('employee-day-off');
                info.el.setAttribute('data-resource-id', resourceId);
              }
            }
          }}
          eventContent={(arg:any) => {
            const ev = arg.event;
            const start = ev.start ? dayjs.utc(ev.start).tz('Africa/Cairo').format('h:mm A') : '';
            const end = ev.end ? dayjs.utc(ev.end).tz('Africa/Cairo').format('h:mm A') : '';
            const title = ev.title || '';
            const isFirst = !!(ev.extendedProps && ev.extendedProps.isFirst);
            const isCleanup = !!(ev.extendedProps && ev.extendedProps.isCleanup);
            const status = ev.extendedProps?.status || ev.extendedProps?.reservation?.status;
            const servicesText = (ev.extendedProps && ev.extendedProps.servicesText) || '';
            const servicesLines = servicesText ? String(servicesText).split(', ') : [];
            const totalDurationMin = (ev.extendedProps && ev.extendedProps.totalDurationMin) as number | undefined;
            const membershipTier = ev.extendedProps?.membershipTier;
            const loyaltyPoints = ev.extendedProps?.loyaltyPoints;
            
            const badge = isFirst ? '<span style="margin-left:6px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.95);color:#000;font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.1);">✨ NEW</span>' : '';
            const servicesHtml = servicesLines.length > 0 ? `<div style="font-size:11px;opacity:.95;margin-top:2px;">${servicesLines.map((line:any) => `<div style="padding:1px 0;">${line}</div>`).join('')}</div>` : '';
            
            // Membership tier badge
            const membershipBadge = membershipTier ? `<div style="font-size:9px;opacity:.9;margin-top:2px;"><span style="padding:1px 4px;border-radius:3px;background:${getMembershipTierColor(membershipTier)};color:white;font-weight:600;">${getMembershipTierDisplay(membershipTier)}</span></div>` : '';
            
            // Loyalty points display
            const loyaltyDisplay = loyaltyPoints ? `<div style="font-size:9px;opacity:.9;margin-top:1px;">⭐ ${loyaltyPoints} pts</div>` : '';
            
            // For cleanup events, show only the stamp (no times, no title, no extras)
            if (isCleanup) {
              const cleanupStamp = '<span style="padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.95);color:#000;font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.1);">🧹 10m</span>';
              const html = `
                <div style="padding:6px 8px;line-height:1.3;display:flex;align-items:center;justify-content:center;min-height:100%;">
                  ${cleanupStamp}
                </div>`;
              return { html };
            }

            // Status stamp by action
            const statusText = (status || '').replace('_',' ').toUpperCase();
            const statusBg = ((): string => {
              switch (status) {
                case 'booked': return 'background:rgba(255,255,255,0.95);color:#1d4ed8;'; // blue
                case 'checked_in': return 'background:rgba(255,255,255,0.95);color:#b45309;'; // amber
                case 'in_service': return 'background:rgba(255,255,255,0.95);color:#6d28d9;'; // purple
                case 'checked_out': return 'background:rgba(255,255,255,0.95);color:#0f766e;'; // teal
                case 'completed': return 'background:rgba(255,255,255,0.95);color:#047857;'; // green
                case 'cancelled': return 'background:rgba(255,255,255,0.95);color:#b91c1c;'; // red
                default: return 'background:rgba(255,255,255,0.95);color:#111827;';
              }
            })();
            const statusStamp = status ? `<span style="margin-left:6px;padding:2px 6px;border-radius:4px;${statusBg}font-size:10px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,0.1);">${statusText}</span>` : '';

            const html = `
              <div style="padding:6px 8px;line-height:1.3;">
                <div style="font-size:10px;opacity:.9;font-weight:600;">${start}</div>
                <div style="font-weight:700;font-size:13px;display:flex;align-items:center;margin:2px 0;">${title}${badge}${statusStamp}</div>
                ${servicesHtml}
                ${typeof totalDurationMin === 'number' ? `<div style="font-size:10px;opacity:.9;margin-top:2px;"><strong>⏱ ${totalDurationMin} min</strong></div>` : ''}
                ${membershipBadge}
                ${loyaltyDisplay}
                <div style="font-size:10px;opacity:.9;font-weight:600;margin-top:2px;">${end}</div>
              </div>`;
            return { html };
          }}
          height="auto"
          datesSet={(dateInfo: any) => {
            handleDatesSet(dateInfo);
            // Update employee styling after date change
            setTimeout(() => {
              const calendarApi = calendarRef.current?.getApi();
              if (!calendarApi) return;

              const view = calendarApi.view;
              const currentDate = view ? new Date(view.activeStart) : selectedDate;

              employees.forEach(employee => {
                const isAvailable = isWithinEmployeeShift(employee.id, currentDate);
                const resourceEl = document.querySelector(`[data-resource-id="${employee.id}"]`);
                if (resourceEl) {
                  if (isAvailable) {
                    resourceEl.classList.remove('employee-day-off');
                  } else {
                    resourceEl.classList.add('employee-day-off');
                  }
                }
              });
            }, 200);
          }}
        />
      </Paper>

      {/* Enhanced Drawer */}
      <Drawer 
        anchor="right" 
        open={drawer.open} 
        onClose={closeDrawer} 
        sx={{ 
          '& .MuiDrawer-paper': { 
            width: 420,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderLeft: '1px solid #e2e8f0',
          } 
        }}
        disableEnforceFocus
        disableRestoreFocus
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Drawer Header */}
          <Box sx={{ 
            p: 3, 
            background: statusGradient(drawer.reservation?.status),
            color: 'white',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box flex={1}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {drawer.reservation?.guest_name}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip 
                    label={(drawer.reservation?.status || '').replace('_',' ').toUpperCase()} 
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.25)', 
                      color: 'white',
                      fontWeight: 700,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)'
                    }} 
                  />
                  {drawer.reservation?.is_first_for_guest && (
                    <Chip 
                      icon={<Star sx={{ fontSize: 16, color: 'white !important' }} />}
                      label="First Visit" 
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.25)', 
                        color: 'white',
                        fontWeight: 700,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)'
                      }} 
                    />
                  )}
                </Box>
              </Box>
              <IconButton 
                onClick={closeDrawer}
                sx={{ 
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
                size="small"
              >
                <Cancel />
              </IconButton>
            </Box>
            
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mt={2}>
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Event sx={{ fontSize: 18, color: 'white' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem' }}>
                      Reservation
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: 'white', fontSize: '0.85rem' }}>
                      #{drawer.reservation?.id}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Schedule sx={{ fontSize: 18, color: 'white' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem' }}>
                      Duration
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: 'white', fontSize: '0.85rem' }}>
                      {drawer.reservation?.total_duration_minutes || 0} min
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Scrollable Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {drawer.reservation ? (
              <Stack spacing={3}>
                {/* Appointment Details */}
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTime sx={{ fontSize: 20, color: '#667eea' }} />
                    Appointment Details
                  </Typography>
                  <Box display="grid" gap={1.5} mt={2}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Staff</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {getEmployeeDisplayName(employees.find(e => e.id === drawer.reservation?.employee) || null)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Location</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {drawer.reservation.location_name ?? '—'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Date & Time</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs.utc(drawer.reservation.start_time).tz('Africa/Cairo').format('MMM D, h:mm A')}
                      </Typography>
                    </Box>
                    {!drawer.reservation.is_first_for_guest && selectedGuest?.total_visits && (
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Total Visits</Typography>
                        <Chip 
                          label={`${selectedGuest.total_visits} visit${selectedGuest.total_visits === 1 ? '' : 's'}`}
                          size="small"
                          sx={{ bgcolor: '#e0e7ff', color: '#667eea', fontWeight: 600 }}
                        />
                      </Box>
                    )}
                  </Box>
                </Paper>

                {/* Services */}
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocalActivity sx={{ fontSize: 20, color: '#667eea' }} />
                    Services
                  </Typography>
                  {Array.isArray(drawer.reservation.reservation_services) && drawer.reservation.reservation_services.length > 0 ? (
                    <Box mt={2}>
                      {drawer.reservation.reservation_services.map((rs, idx) => {
                        const qty = rs.quantity ?? 1;
                        const duration = rs.service_duration_minutes ?? rs.service_details?.duration_minutes ?? 0;
                        const unit = Number(rs.unit_price ?? (rs.service_details?.price ?? '0'));
                        const subtotal = unit * qty;
                        return (
                          <Box 
                            key={idx} 
                            sx={{ 
                              p: 2, 
                              mb: 2, 
                              bgcolor: '#f8fafc', 
                              borderRadius: 2,
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="body2" fontWeight={700}>
                                {rs.service_details?.name ?? `Service #${rs.service}`}
                              </Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#667eea' }}>
                                ${subtotal.toFixed(2)}
                              </Typography>
                            </Box>
                            <Box display="flex" gap={2} flexWrap="wrap">
                              <Chip label={`${duration} min`} size="small" sx={{ bgcolor: 'white', fontSize: '0.7rem' }} />
                              <Chip label={`Qty: ${qty}`} size="small" sx={{ bgcolor: 'white', fontSize: '0.7rem' }} />
                              <Chip label={`${unit.toFixed(2)} each`} size="small" sx={{ bgcolor: 'white', fontSize: '0.7rem' }} />
                            </Box>
                          </Box>
                        );
                      })}
                      <Box display="flex" justifyContent="space-between" mt={2} pt={2} borderTop="2px solid #e2e8f0">
                        <Typography variant="h6" fontWeight={700}>Total</Typography>
                        <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                          ${(drawer.reservation.total_price ?? 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No services</Typography>
                  )}
                </Paper>

                {/* Payment & Deposit Information */}
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Payment sx={{ fontSize: 20, color: '#667eea' }} />
                    Payment & Deposit Status
                  </Typography>
                  
                  <Box display="grid" gap={2} mt={2}>
                    {/* Deposit Status */}
                    {drawer.reservation.deposit_required && (
                      <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <AccountBalance sx={{ fontSize: 18, color: '#667eea' }} />
                          <Typography variant="subtitle2" fontWeight={600}>
                            Deposit Required
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary">
                            Amount: ${drawer.reservation.deposit_amount || '0.00'}
                          </Typography>
                          <Chip 
                            label={drawer.reservation.deposit_paid ? 'PAID' : 'PENDING'}
                            size="small"
                            color={drawer.reservation.deposit_paid ? 'success' : 'warning'}
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                        {drawer.reservation.deposit_paid_at && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Paid: {dayjs.utc(drawer.reservation.deposit_paid_at).tz('Africa/Cairo').format('MMM D, h:mm A')}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* No Deposit Required */}
                    {!drawer.reservation.deposit_required && (
                      <Box sx={{ p: 2, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #bae6fd' }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CheckCircle sx={{ fontSize: 18, color: '#0ea5e9' }} />
                          <Typography variant="body2" fontWeight={600} color="#0c4a6e">
                            No Deposit Required
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Payment Status Summary */}
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Receipt sx={{ fontSize: 18, color: '#667eea' }} />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Payment Summary
                        </Typography>
                      </Box>
                      <Box display="grid" gap={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Service Total</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            ${(drawer.reservation.total_price || 0).toFixed(2)}
                          </Typography>
                        </Box>
                        {drawer.reservation.deposit_required && drawer.reservation.deposit_paid && (
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Deposit Paid</Typography>
                            <Typography variant="body2" fontWeight={600} color="success.main">
                              -${drawer.reservation.deposit_amount || '0.00'}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" justifyContent="space-between" pt={1} borderTop="1px solid #e2e8f0">
                          <Typography variant="body2" fontWeight={600}>Balance Due</Typography>
                          <Typography variant="body2" fontWeight={700} color="#667eea">
                            ${((drawer.reservation.total_price || 0) - (drawer.reservation.deposit_paid ? parseFloat(drawer.reservation.deposit_amount || '0') : 0)).toFixed(2)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Payment Status Indicators */}
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {drawer.reservation.deposit_required && drawer.reservation.deposit_paid && (
                        <Chip 
                          icon={<TrendingUp />}
                          label="Deposit Collected" 
                          size="small" 
                          color="success" 
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {drawer.reservation.status === 'completed' && (
                        <Chip 
                          icon={<CreditCard />}
                          label="Ready for Payment" 
                          size="small" 
                          color="info" 
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {drawer.reservation.status === 'checked_out' && (
                        <Chip 
                          icon={<CheckCircle />}
                          label="Payment Complete" 
                          size="small" 
                          color="success" 
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>

                {/* Guest Info */}
                {selectedGuest && (
                  <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person sx={{ fontSize: 20, color: '#667eea' }} />
                      Guest Information
                    </Typography>
                    <Box display="grid" gap={2} mt={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ p: 1.5, bgcolor: '#e0e7ff', borderRadius: 2 }}>
                          <EmailIcon sx={{ fontSize: 20, color: '#667eea' }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="caption" color="text.secondary">Email</Typography>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {selectedGuest.email || 'Not provided'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ p: 1.5, bgcolor: '#ddd6fe', borderRadius: 2 }}>
                          <Phone sx={{ fontSize: 20, color: '#8b5cf6' }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="caption" color="text.secondary">Phone</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedGuest.phone || 'Not provided'}
                          </Typography>
                        </Box>
                      </Box>
                      {selectedGuest.membership_tier && (
                        <Box display="flex" alignItems="center" gap={2}>
                          <Box sx={{ p: 1.5, bgcolor: '#fef3c7', borderRadius: 2 }}>
                            <Star sx={{ fontSize: 20, color: '#f59e0b' }} />
                          </Box>
                          <Box flex={1}>
                            <Typography variant="caption" color="text.secondary">Membership</Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {typeof selectedGuest.membership_tier === 'string' ? selectedGuest.membership_tier : selectedGuest.membership_tier?.display_name}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      <Button 
                        variant="outlined" 
                        size="small" 
                        fullWidth
                        onClick={() => setIsEditGuestOpen(true)}
                        sx={{ 
                          mt: 1,
                          borderColor: '#667eea',
                          color: '#667eea',
                          fontWeight: 600,
                          textTransform: 'none',
                          borderRadius: 2,
                          '&:hover': {
                            borderColor: '#5568d3',
                            bgcolor: '#e0e7ff'
                          }
                        }}
                      >
                        Edit Guest Profile
                      </Button>
                    </Box>
                  </Paper>
                )}

                {/* Action Buttons */}
                <Stack spacing={2}>
                  <Button 
                    variant="outlined" 
                    onClick={() => openEditReservation(drawer.reservation!.id)}
                    fullWidth
                    sx={{
                      borderColor: '#667eea',
                      color: '#667eea',
                      fontWeight: 600,
                      textTransform: 'none',
                      py: 1.5,
                      borderRadius: 2,
                      '&:hover': {
                        borderColor: '#5568d3',
                        bgcolor: '#e0e7ff'
                      }
                    }}
                  >
                    Edit Reservation
                  </Button>
                  
                  {drawer.reservation.status === 'booked' && (
                    <>
                      {drawer.reservation.deposit_required && !drawer.reservation.deposit_paid && (
                        <Button 
                          variant="contained" 
                          onClick={() => {
                            if (drawer.reservation) {
                              setDepositDialogOpen(true);
                            }
                          }}
                          fullWidth
                          sx={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            fontWeight: 600,
                            textTransform: 'none',
                            py: 1.5,
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                              boxShadow: '0 6px 16px rgba(245, 158, 11, 0.5)',
                            }
                          }}
                        >
                          Collect Deposit (${drawer.reservation.deposit_amount || '0.00'})
                        </Button>
                      )}
                      <Button 
                        variant="contained" 
                        onClick={() => act('check_in')} 
                        disabled={isActing}
                        fullWidth
                        sx={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          fontWeight: 600,
                          textTransform: 'none',
                          py: 1.5,
                          borderRadius: 2,
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            boxShadow: '0 6px 16px rgba(59, 130, 246, 0.5)',
                          }
                        }}
                      >
                        Check-in Guest
                      </Button>
                    </>
                  )}
                  
                  {drawer.reservation.status === 'checked_in' && (
                    <Button 
                      variant="contained" 
                      onClick={() => act('in_service')} 
                      disabled={isActing}
                      fullWidth
                      sx={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        fontWeight: 600,
                        textTransform: 'none',
                        py: 1.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                          boxShadow: '0 6px 16px rgba(139, 92, 246, 0.5)',
                        }
                      }}
                    >
                      Start Service
                    </Button>
                  )}
                  
                  {drawer.reservation.status === 'in_service' && (
                    <Button 
                      variant="contained" 
                      onClick={() => act('complete')} 
                      disabled={isActing}
                      fullWidth
                      sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontWeight: 600,
                        textTransform: 'none',
                        py: 1.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          boxShadow: '0 6px 16px rgba(16, 185, 129, 0.5)',
                        }
                      }}
                    >
                      Complete Service
                    </Button>
                  )}
                  
                  {drawer.reservation.status === 'completed' && (
                    <Button 
                      variant="contained" 
                      onClick={() => act('check_out')} 
                      disabled={isActing}
                      fullWidth
                      sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontWeight: 600,
                        textTransform: 'none',
                        py: 1.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          boxShadow: '0 6px 16px rgba(16, 185, 129, 0.5)',
                        }
                      }}
                    >
                      Check Out & Create Invoice
                    </Button>
                  )}
                  
                  {(drawer.reservation.status === 'booked' || drawer.reservation.status === 'checked_in') && (
                    <Button 
                      variant="outlined" 
                      onClick={() => act('cancel')} 
                      disabled={isActing}
                      fullWidth
                      sx={{
                        borderColor: '#ef4444',
                        color: '#ef4444',
                        fontWeight: 600,
                        textTransform: 'none',
                        py: 1.5,
                        borderRadius: 2,
                        '&:hover': {
                          borderColor: '#dc2626',
                          bgcolor: '#fef2f2'
                        }
                      }}
                    >
                      Cancel Reservation
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">No selection</Typography>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Edit Guest Dialog */}
      <EditGuestDialog
        open={isEditGuestOpen}
        guest={selectedGuest}
        onClose={() => setIsEditGuestOpen(false)}
        onUpdated={(g: any) => {
          setSelectedGuest(g);
          if (drawer.reservation) {
            setDrawer({ open: true, reservation: { ...drawer.reservation, guest_name: `${g.first_name} ${g.last_name}` } as any });
          }
        }}
      />

      {/* Edit Reservation Dialog */}
      <Dialog 
        open={editDialog.open} 
        onClose={() => setEditDialog({ open: false, reservation: null })} 
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
          Edit Reservation
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <ReservationBookingForm
            reservation={editDialog.reservation as any}
            onSaved={async () => {
              setEditDialog({ open: false, reservation: null });
              await loadData();
              if (drawer.reservation && editDialog.reservation) {
                const updated = (await api.get(`/reservations/${(editDialog.reservation as any).id}/`)).data;
                setDrawer({ open: true, reservation: updated });
              }
            }}
            onClose={() => setEditDialog({ open: false, reservation: null })}
          />
        </DialogContent>
      </Dialog>

      {/* Create Reservation Dialog */}
      <Dialog 
        open={createDialog.open} 
        onClose={() => setCreateDialog({ open: false })} 
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
          New Reservation
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
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
          elevation: 20,
          sx: {
            mt: 1,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 60px rgba(102, 126, 234, 0.25)',
            overflow: 'hidden'
          }
        }}
      >
        {renderMiniCalendar()}
      </Popover>

      {/* Context Menu */}
      <Menu
        aria-label="Reservation actions"
        anchorEl={menuAnchor?.element || null}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setTimeout(() => {
            const calendarElement = document.querySelector('.fc') as HTMLElement;
            if (calendarElement) {
              calendarElement.focus();
            }
          }, 100);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableAutoFocusItem
        autoFocus={false}
        disableEnforceFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e2e8f0',
            minWidth: 200,
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1.5,
              fontWeight: 500,
              '&:hover': {
                bgcolor: '#f8fafc'
              }
            }
          }
        }}
      >
        <MenuItem onClick={() => {
          const r = menuAnchor?.reservation;
          if (r) openDrawer(r);
          setMenuAnchor(null);
        }}>
          <Visibility sx={{ mr: 1.5, fontSize: 18 }} />
          View Details
        </MenuItem>
        <Divider />
        {(() => {
          const status = menuAnchor?.reservation?.status;
          if (status === 'booked') return (
            <MenuItem onClick={() => act('check_in')} disabled={isActing}>
              <CheckCircle sx={{ mr: 1.5, fontSize: 18, color: '#3b82f6' }} />
              Check-in Guest
            </MenuItem>
          );
          if (status === 'checked_in') return (
            <MenuItem onClick={() => act('in_service')} disabled={isActing}>
              <Schedule sx={{ mr: 1.5, fontSize: 18, color: '#8b5cf6' }} />
              Start Service
            </MenuItem>
          );
          if (status === 'in_service') return (
            <MenuItem onClick={() => act('complete')} disabled={isActing}>
              <CheckCircle sx={{ mr: 1.5, fontSize: 18, color: '#10b981' }} />
              Mark Complete
            </MenuItem>
          );
          if (status === 'completed') return (
            <MenuItem onClick={() => act('check_out')} disabled={isActing}>
              <AttachMoney sx={{ mr: 1.5, fontSize: 18, color: '#10b981' }} />
              Check Out Guest
            </MenuItem>
          );
          return null;
        })()}
        {menuAnchor?.reservation && (menuAnchor.reservation.status === 'booked' || menuAnchor.reservation.status === 'checked_in') && [
          <Divider key="menu-divider-cancel" />,
          <MenuItem 
            key="menu-item-cancel" 
            onClick={() => act('cancel')} 
            sx={{ color: '#ef4444' }} 
            disabled={isActing}
          >
            <Cancel sx={{ mr: 1.5, fontSize: 18 }} />
            Cancel Reservation
          </MenuItem>
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

      {/* Invoice Dialog */}
      <Dialog
        open={invoiceDialogOpen}
        onClose={() => {
          setInvoiceDialogOpen(false);
          setCreatedInvoiceId(null);
        }}
        maxWidth="lg"
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700
        }}>
          <Typography component="span" variant="h6">Invoice & Payment</Typography>
          <IconButton
            onClick={() => {
              setInvoiceDialogOpen(false);
              setCreatedInvoiceId(null);
            }}
            sx={{ color: 'white' }}
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
                loadData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
          {drawer.reservation && (
            <ReservationDepositForm
              reservationId={drawer.reservation.id}
              depositAmount={drawer.reservation.deposit_amount || '0.00'}
              guestName={drawer.reservation.guest_name}
              onDepositCollected={async () => {
                setDepositDialogOpen(false);
                await loadData();
                if (drawer.reservation) {
                  try {
                    const updated = (await api.get(`/reservations/${drawer.reservation.id}/`)).data;
                    setDrawer({ open: true, reservation: updated });
                  } catch {
                    // ignore refresh errors
                  }
                }
              }}
              onClose={() => setDepositDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      {reservationToRefund && (
        <RefundDialog
          open={refundDialogOpen}
          onClose={() => {
            setRefundDialogOpen(false);
            setReservationToRefund(null);
          }}
          reservationId={reservationToRefund.id}
          depositAmount={reservationToRefund.deposit_amount || '0.00'}
          guestName={reservationToRefund.guest_name || 'Guest'}
          onRefundProcessed={handleRefundProcessed}
        />
      )}
    </Box>
  );
};

export default StaffSchedulingCalendar;