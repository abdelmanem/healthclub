import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Avatar,
  Tooltip,
  useTheme,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Drawer,
  Stack,
  Button,
  Divider,
  Menu,
  Popover
} from '@mui/material';
  import {
    GridView,
    Refresh,
    Add,
    Person,
    Folder,
    Print,
    Today,
    ChevronLeft,
    ChevronRight,
    CalendarToday,
    AttachMoney,
    Star,
    CheckCircle,
    ThumbUp,
    NewReleases,
    Warning,
    Edit,
    Delete
  } from '@mui/icons-material';
import { SpaAppointment, SpaStaff } from '../../services/spaScheduling';
import { ReservationBookingForm } from './ReservationBookingForm';
import { api } from '../../services/api';
import { useDateContext } from '../common/SpaLayout';
import dayjs from 'dayjs';

  // Use the types from the service
  type Appointment = SpaAppointment;
  type Staff = SpaStaff;

  // Generate time slots from 06:00 to 00:59 (next day)
  const MINIMUM_ROW_HEIGHT = 20; // Minimum height per 30-minute slot for readability
  const PREFERRED_ROW_HEIGHT = 30; // Preferred height per 30-minute slot
  const generateTimeSlots = () => {
    const slots = [];
    
    // Early morning slots: 06:00 to 07:59
    for (let hour = 6; hour < 8; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // Morning slots: 08:00 to 11:59
    for (let hour = 8; hour < 12; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // Afternoon slots: 12:00 to 17:59
    for (let hour = 12; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // Evening slots: 18:00 to 23:59
    for (let hour = 18; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // Night slots: 00:00 to 00:59 (next day)
    slots.push('00:00');
    slots.push('00:30');
    
    return slots;
  };

  const timeSlots = generateTimeSlots();
  console.log('Generated time slots:', timeSlots.length, timeSlots);
  console.log('First 10 slots:', timeSlots.slice(0, 10));
  console.log('Last 10 slots:', timeSlots.slice(-10));

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <NewReleases sx={{ fontSize: 10, color: '#3B82F6' }} />;
      case 'completed':
        return <CheckCircle sx={{ fontSize: 10, color: '#10B981' }} />;
      case 'blocked':
        return <Warning sx={{ fontSize: 10, color: '#F59E0B' }} />;
      default:
        return null;
    }
  };

  const getAppointmentColor = (color: string) => {
    switch (color) {
      case 'green':
        return '#10B981';
      case 'red':
        return '#EF4444';
      case 'grey':
      default:
        return '#6B7280';
    }
  };

export const AppointmentSchedulingGrid: React.FC = () => {
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [localDate, setLocalDate] = useState(new Date());
  
  // Try to use shared date context from SpaLayout, fallback to local state
  let selectedDate: Date;
  let setSelectedDate: (date: Date) => void;
  
  try {
    const dateContext = useDateContext();
    selectedDate = dateContext.selectedDate;
    setSelectedDate = dateContext.setSelectedDate;
  } catch {
    // Fallback to local state if not within SpaLayout
    selectedDate = localDate;
    setSelectedDate = setLocalDate;
  }
    const [staff, setStaff] = useState<Staff[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [drawer, setDrawer] = useState<{ open: boolean; appointment?: Appointment | null }>({ open: false, appointment: null });
    const [createDialog, setCreateDialog] = useState<{ open: boolean; start?: string; staffId?: string; locationId?: number }>({ open: false });
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuAppointment, setMenuAppointment] = useState<Appointment | null>(null);
  const [calendarAnchor, setCalendarAnchor] = useState<null | HTMLElement>(null);
  const [monthlyReservations, setMonthlyReservations] = useState<Record<string, number>>({});
    const theme = useTheme();
    const currentTime = getCurrentTime();
    const headerRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const topControlsRef = useRef<HTMLDivElement | null>(null);
    const [gridHeight, setGridHeight] = useState<number>(480);
    
    // Calculate dynamic row height based on available space
    const totalSlots = timeSlots.length;
    const dynamicRowHeight = Math.floor(gridHeight / totalSlots);
    // Use preferred height if there's enough space, otherwise use dynamic with minimum fallback
    const ROW_HEIGHT = dynamicRowHeight >= PREFERRED_ROW_HEIGHT 
      ? PREFERRED_ROW_HEIGHT 
      : Math.max(dynamicRowHeight, MINIMUM_ROW_HEIGHT);
    const PER_MINUTE_PX = ROW_HEIGHT / 30; // pixel scale per minute

    // Debug clock removed

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    };

    // Load data on component mount and date change
    useEffect(() => {
      loadSchedulingData();
    }, [selectedDate]);

    const loadSchedulingData = async () => {
      try {
        setLoading(true);
        setError(null);
        
      const dateString = selectedDate.toISOString().split('T')[0];
      console.log('Loading scheduling data for date:', dateString);
        
      // Load directly from /reservations and /employees
      const [reservationsRes, employeesRes] = await Promise.all([
        api.get(`/reservations/?start_time__date=${dateString}`).catch(err => {
          console.error('Failed to load reservations:', err);
          return { data: { results: [] } };
        }),
        api.get('/employees/').catch(err => {
          console.error('Failed to load employees:', err);
          return { data: { results: [] } };
        })
      ]);

      const reservations = reservationsRes.data.results || reservationsRes.data || [];
      const employees = employeesRes.data.results || employeesRes.data || [];

      console.log('Loaded reservations:', reservations.length);
      console.log('Loaded employees:', employees.length);

        // Convert reservations to spa format used by this grid
        const spaAppointments: SpaAppointment[] = reservations.map((reservation: any) => ({
          id: reservation.id.toString(),
          customerName: reservation.guest_name || 'Unknown Guest',
          serviceName: 'Service',
          duration: (() => {
            try {
              const diff = dayjs(reservation.end_time).diff(dayjs(reservation.start_time), 'minute');
              return isNaN(diff) ? 60 : Math.max(30, diff);
            } catch { return 60; }
          })(),
          startTime: dayjs(reservation.start_time).format('HH:mm'),
          endTime: dayjs(reservation.end_time).format('HH:mm'),
          status: (reservation.status === 'booked' ? 'confirmed' : 
                reservation.status === 'completed' ? 'completed' : 
                reservation.status === 'cancelled' ? 'blocked' : 'confirmed') as 'new' | 'completed' | 'blocked' | 'confirmed',
          room: reservation.location_name,
          price: 0,
          staffId: reservation.employee ? reservation.employee.toString() : (reservation.employee_assignments?.[0]?.employee?.toString?.() || ''),
          color: reservation.status === 'booked' ? 'green' : 
                reservation.status === 'completed' ? 'grey' : 
                reservation.status === 'cancelled' ? 'red' : 'grey',
          customerId: reservation.guest?.toString() || '',
          serviceId: null,
          notes: reservation.notes || ''
        }));

        const spaStaff: SpaStaff[] = employees.map((employee: any) => {
          const first = employee.first_name || employee.user?.first_name || '';
          const last = employee.last_name || employee.user?.last_name || '';
          const fullName = `${first} ${last}`.trim();
          const username = employee.username || employee.user?.username || '';
          const display = fullName || username || (employee.name || '');
          const fallback = `Staff #${employee.id}`;
          const label = display || fallback;
          return {
            id: employee.id.toString(),
            name: label,
            displayName: label,
            avatar: undefined,
            isActive: employee.active,
            services: []
          } as SpaStaff;
        });

        setAppointments(spaAppointments);
        setStaff(spaStaff);

      // Only show sample data if we have no staff (indicating API failure or empty database)
      // If we have staff but no appointments, that's normal - just show empty schedule
      if (spaStaff.length === 0) {
        console.log('No staff data found, creating sample data for testing (API might be failing)');
          const sampleStaff: SpaStaff[] = [
            { id: '1', name: 'Ayu Putri', displayName: 'Ayu', avatar: undefined, isActive: true, services: [] },
            { id: '2', name: 'Dhora Ramirez', displayName: 'Dhora', avatar: undefined, isActive: true, services: [] },
            { id: '3', name: 'Malak Hassan', displayName: 'Malak', avatar: undefined, isActive: true, services: [] },
            { id: '4', name: 'Fatma Sallam', displayName: 'Farah', avatar: undefined, isActive: true, services: [] },
            { id: '5', name: 'Shereen Radwan', displayName: 'Shereen', avatar: undefined, isActive: true, services: [] }
          ];
          
          const sampleAppointments: SpaAppointment[] = [
            {
              id: '1',
              customerName: 'Amira Anwar',
              serviceName: 'The Arabian (50 min)',
              duration: 50,
              startTime: '13:00',
              endTime: '13:50',
              status: 'confirmed',
              room: '1 Massage Room',
              price: 150,
              staffId: '1',
              color: 'grey',
              customerId: '1',
              serviceId: '1',
              notes: ''
            },
            {
              id: '2',
              customerName: 'Ibrahim Mekawy',
              serviceName: 'The Arabian (80 min)',
              duration: 80,
              startTime: '13:00',
              endTime: '14:20',
              status: 'confirmed',
              room: '3 Massage Room Double',
              price: 200,
              staffId: '3',
              color: 'grey',
              customerId: '2',
              serviceId: '1',
              notes: ''
            },
            {
              id: '3',
              customerName: 'Laith Laith',
              serviceName: 'The Arabian (50 min)',
              duration: 50,
              startTime: '13:30',
              endTime: '14:20',
              status: 'confirmed',
              room: '2 Massage Room',
              price: 150,
              staffId: '4',
              color: 'grey',
              customerId: '3',
              serviceId: '1',
              notes: ''
            }
          ];
        
        setStaff(sampleStaff);
        setAppointments(sampleAppointments);
      } else {
        console.log(`Loaded ${spaStaff.length} staff members and ${spaAppointments.length} appointments for ${dateString}`);
      }
      } catch (err) {
        console.error('Error loading scheduling data:', err);
        setError('Failed to load scheduling data');
      } finally {
        setLoading(false);
      }
    };

    const handleDateChange = (direction: 'prev' | 'next') => {
      const newDate = new Date(selectedDate);
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      setSelectedDate(newDate);
    };

    const handleRefresh = () => {
      loadSchedulingData();
    };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleCalendarClick = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarAnchor(event.currentTarget);
    loadMonthlyReservations(selectedDate);
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

  const handleCalendarClose = () => {
    setCalendarAnchor(null);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    handleCalendarClose();
  };

  // Mini calendar helper functions
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
            onClick={() => handleDateSelect(new Date())}
            startIcon={<Today />}
          >
            Today
          </Button>
        </Box>
      </Box>
    );
  };

    // Dynamically compute grid height from viewport and header heights
    useEffect(() => {
      const recalc = () => {
        try {
          const viewportH = window.innerHeight || 800;
          const topBarH = topControlsRef.current?.getBoundingClientRect()?.height || 0;
          const headerH = headerRef.current?.getBoundingClientRect()?.height || 0;
          const padding = 8; // reduced safety padding for taller viewport
          const h = Math.max(300, viewportH - topBarH - headerH - padding);
          setGridHeight(h);
        } catch {}
      };
      recalc();
      window.addEventListener('resize', recalc);
      return () => window.removeEventListener('resize', recalc);
    }, []);

    // Reservation management functions
    const openDrawer = (appointment: Appointment) => setDrawer({ open: true, appointment });
    const closeDrawer = () => setDrawer({ open: false, appointment: null });

    const handleCreateReservation = (time: string, staffId: string) => {
      const dateString = selectedDate.toISOString().split('T')[0];
      const startDateTime = `${dateString}T${time}:00`;
      setCreateDialog({
        open: true,
        start: startDateTime,
        staffId: staffId,
        locationId: undefined
      });
    };

    const handleAppointmentClick = (appointment: Appointment, e?: React.MouseEvent<HTMLElement>) => {
      if (e) {
        setMenuAnchor(e.currentTarget);
        setMenuAppointment(appointment);
      } else {
        setMenuAppointment(appointment);
      }
    };

    const closeMenu = () => {
      setMenuAnchor(null);
    };

    const handleAppointmentDragStart = (appointment: Appointment) => {
      setDraggedAppointment(appointment);
    };

    const handleAppointmentDrop = async (appointment: Appointment, newStaffId: string, newTime: string) => {
      try {
        const dateString = selectedDate.toISOString().split('T')[0];
        const newStartDateTime = `${dateString}T${newTime}:00`;
        const newEndDateTime = dayjs(newStartDateTime).add(appointment.duration, 'minutes').toISOString();

        // Update the reservation via /reservations/
        const body: any = {
          start_time: dayjs(newStartDateTime).toISOString(),
          end_time: newEndDateTime,
        };
        // Attempt to set employee directly if supported
        if (newStaffId) {
          const parsed = parseInt(newStaffId, 10);
          if (!isNaN(parsed)) body.employee = parsed;
        }
        await api.patch(`/reservations/${appointment.id}/`, body);

        // Reload data to reflect changes
        await loadSchedulingData();
      } catch (error) {
        console.error('Failed to move appointment:', error);
        alert('Failed to move appointment. Please try again.');
      }
    };

    const handleReservationAction = async (action: 'check_in' | 'in_service' | 'complete' | 'cancel') => {
      const appointment = drawer.appointment;
      if (!appointment) return;

      try {
        // Map spa appointment status to reservation status
        const statusMap: Record<string, string> = {
          'confirmed': 'booked',
          'new': 'booked',
          'completed': 'completed',
          'blocked': 'cancelled'
        };

        const currentStatus = statusMap[appointment.status] || 'booked';
        
        // Update reservation status based on action
        let newStatus = currentStatus;
        if (action === 'check_in') newStatus = 'checked_in';
        else if (action === 'in_service') newStatus = 'in_service';
        else if (action === 'complete') newStatus = 'completed';
        else if (action === 'cancel') newStatus = 'cancelled';

        // Update the reservation
        await api.patch(`/reservations/${appointment.id}/`, { status: newStatus });
        await loadSchedulingData();
        closeDrawer();
      } catch (error) {
        console.error('Failed to update reservation:', error);
        alert('Failed to update reservation. Please try again.');
      }
    };

    const getAppointmentsForStaff = (staffId: string) => {
      return appointments.filter(apt => apt.staffId === staffId);
    };

    // Render only at the exact start time so the block can span multiple slots
    const getAppointmentAtTime = (staffId: string, time: string) => {
      const [h, m] = time.split(':').map(Number);
      const slotMinutes = h * 60 + m;

      const appointment = appointments.find((apt) => {
        if (apt.staffId !== staffId) return false;
        const [sh, sm] = apt.startTime.split(':').map(Number);
        const start = sh * 60 + sm;
        return slotMinutes === start;
      });

      // Debug logging
      if (staffId === '3' && appointments.length > 0) {
        console.log(`Looking for appointment at time ${time} for staff ${staffId}`);
        console.log('Available appointments:', appointments.map(apt => ({ staffId: apt.staffId, startTime: apt.startTime, endTime: apt.endTime, customerName: apt.customerName })));
        console.log('Found appointment:', appointment);
      }

      return appointment;
    };

    const isCurrentTime = (time: string) => {
      return currentTime >= time && currentTime < time;
    };

    const getCurrentTimePosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Calculate position based on 6:00 AM start time
      const startHour = 6;
      const totalMinutes = (currentHour - startHour) * 60 + currentMinute;
      
      // Handle overnight hours (00:00 to 05:59)
      if (currentHour < startHour) {
        const overnightMinutes = (24 - startHour + currentHour) * 60 + currentMinute;
        return overnightMinutes * PER_MINUTE_PX;
      }
      
      return totalMinutes * PER_MINUTE_PX;
    };

    // Auto-scroll to current time when viewing today
    useEffect(() => {
      const isToday = new Date(selectedDate).toDateString() === new Date().toDateString();
      if (!isToday) return;
      const container = document.getElementById('appointment-grid-scroll');
      if (!container) return;
      const position = getCurrentTimePosition();
      // Center the current time line if possible
      container.scrollTo({ top: Math.max(position - 200, 0), behavior: 'smooth' });
    }, [selectedDate, loading]);

    if (loading) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert severity="error" action={
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          }>
            {error}
          </Alert>
        </Box>
      );
    }

    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <Box ref={topControlsRef} sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: 'white'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton>
              <GridView />
            </IconButton>
            
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Staff</MenuItem>
                {staff.map((staffMember) => (
                  <MenuItem key={staffMember.id} value={staffMember.id}>
                    {staffMember.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton onClick={() => handleDateChange('prev')}>
              <ChevronLeft />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <IconButton onClick={goToToday}>
                <Today />
              </IconButton>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {formatDate(selectedDate)}
              </Typography>
              <IconButton onClick={handleCalendarClick}>
                <CalendarToday />
              </IconButton>
            </Box>
            
            <IconButton onClick={() => handleDateChange('next')}>
              <ChevronRight />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
            <IconButton onClick={() => setCreateDialog({ open: true })}>
              <Add />
            </IconButton>
            <IconButton>
              <Person />
            </IconButton>
            <IconButton>
              <Folder />
            </IconButton>
            <IconButton>
              <Print />
            </IconButton>
            {/* timezone debug removed */}
          </Box>
        </Box>

        {/* Staff Headers */}
        <Box sx={{ 
          display: 'flex', 
          borderBottom: '2px solid #E5E7EB',
          backgroundColor: 'white',
          overflowX: 'hidden'
        }} ref={headerRef}>
          <Box sx={{ width: 50, minWidth: 50, p: 1.5, borderRight: '1px solid #E5E7EB', flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              Time
            </Typography>
          </Box>
          {staff.map((staffMember) => (
            <Box 
              key={staffMember.id} 
              sx={{ 
                width: 200, 
                minWidth: 200,
                p: 1.5, 
                borderRight: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexShrink: 0
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>
                {staffMember.displayName}
              </Typography>
              <IconButton size="small">
                <ChevronRight sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
        </Box>

        {/* Grid Content */}
        <Box id="appointment-grid-scroll" ref={scrollRef} onScroll={(e) => {
          try {
            if (headerRef.current) {
              headerRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
            }
          } catch {}
        }} sx={{ 
          flex: 1, 
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          height: `${gridHeight}px`,
          scrollBehavior: 'smooth'
        }}>
          <Box sx={{ 
            display: 'flex', 
            minHeight: `${timeSlots.length * ROW_HEIGHT}px`,
            width: `${100 + staff.length * 200}px`
          }}>
            {/* Time Column */}
            <Box sx={{ 
              width: 50, 
              minWidth: 50, 
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 2,
              backgroundColor: 'white',
              borderRight: '2px solid #E5E7EB'
            }}>
              {timeSlots.map((time, index) => {
                if (index === 0) console.log('Rendering time slots:', timeSlots.length);
                const isHour = time.endsWith(':00');
                return (
                <Box 
                  key={time}
                  sx={{ 
                    height: ROW_HEIGHT, 
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  {isHour && (
                    <Typography variant="caption" sx={{ color: '#111827', fontWeight: 600, lineHeight: 1 }}>
                      {time}
                    </Typography>
                  )}
                  {!isHour && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      height: '1px', 
                      backgroundColor: '#E5E7EB',
                      opacity: 0.5
                    }} />
                  )}
                </Box>
                );
              })}
            </Box>

            {/* Staff Columns */}
            {staff.map((staffMember) => (
              <Box key={staffMember.id} sx={{ width: 200, minWidth: 200, flexShrink: 0 }}>
                {timeSlots.map((time) => {
                  const appointment = getAppointmentAtTime(staffMember.id, time);
                  const slotSpan = appointment ? Math.max(1, Math.ceil((appointment.duration || 30) / 30)) : 1;
                  const isCurrentTimeSlot = currentTime >= time && currentTime < time;
                  
                  // Debug logging for appointments
                  if (appointment && staffMember.id === '3') {
                    console.log(`Found appointment for staff ${staffMember.id} at time ${time}:`, appointment);
                  }
                  
                  return (
                    <Box 
                      key={`${staffMember.id}-${time}`}
                      onClick={() => !appointment && handleCreateReservation(time, staffMember.id)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedAppointment) {
                          handleAppointmentDrop(draggedAppointment, staffMember.id, time);
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      sx={{ 
                        height: ROW_HEIGHT, 
                        borderBottom: '1px solid #E5E7EB',
                        borderRight: '1px solid #E5E7EB',
                        position: 'relative',
                        backgroundColor: isCurrentTimeSlot ? '#FEF3C7' : 'white',
                        cursor: !appointment ? 'pointer' : 'default',
                        '&:hover': !appointment ? {
                          backgroundColor: '#F3F4F6'
                        } : {}
                      }}
                    >
                      {appointment && (
                        <Paper
                          draggable
                          onDragStart={() => handleAppointmentDragStart(appointment)}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedAppointment && draggedAppointment.id !== appointment.id) {
                              handleAppointmentDrop(draggedAppointment, staffMember.id, time);
                            }
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={(e) => handleAppointmentClick(appointment, e)}
                          sx={{
                            position: 'absolute',
                            top: 1,
                            left: 1,
                            right: 1,
                            height: `${Math.max(slotSpan * ROW_HEIGHT - 2, Math.max(ROW_HEIGHT - 2, 10))}px`,
                            backgroundColor: getAppointmentColor(appointment.color),
                            color: 'white',
                            p: 0.5,
                            borderRadius: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            '&:hover': {
                              boxShadow: 2,
                              transform: 'scale(1.01)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1 }}>
                              {appointment.customerName}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.95, lineHeight: 1 }}>
                              {appointment.serviceName}
                            </Typography>
                            {appointment.room && (
                              <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.9, display: 'block', lineHeight: 1 }}>
                                {appointment.room}
                              </Typography>
                            )}
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {getStatusIcon(appointment.status)}
                              {appointment.status === 'new' && (
                                <Chip 
                                  label="NEW" 
                                  size="small" 
                                  sx={{ 
                                    height: 14, 
                                    fontSize: '0.55rem',
                                    backgroundColor: '#3B82F6',
                                    color: 'white'
                                  }} 
                                />
                              )}
                              {appointment.status === 'completed' && (
                                <ThumbUp sx={{ fontSize: 12, color: '#FCD34D' }} />
                              )}
                            </Box>
                            
                            {appointment.price && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AttachMoney sx={{ fontSize: 10 }} />
                                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                                  {appointment.price}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>

          {/* Current Time Indicator */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: '#EF4444',
              zIndex: 10,
              top: `${getCurrentTimePosition()}px`
            }}
          />
        </Box>

        {/* Context menu for appointment actions */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <MenuItem onClick={() => { if (menuAppointment) openDrawer(menuAppointment); closeMenu(); }}>Open Details</MenuItem>
          <MenuItem onClick={() => { if (menuAppointment) handleReservationAction('check_in'); closeMenu(); }}>Check-in</MenuItem>
          <MenuItem onClick={() => { if (menuAppointment) handleReservationAction('in_service'); closeMenu(); }}>Start Service</MenuItem>
          <MenuItem onClick={() => { if (menuAppointment) handleReservationAction('complete'); closeMenu(); }}>Complete</MenuItem>
          <MenuItem onClick={() => { if (menuAppointment) handleReservationAction('cancel'); closeMenu(); }} sx={{ color: 'error.main' }}>Cancel</MenuItem>
        </Menu>

        {/* Appointment Details Drawer */}
        <Drawer anchor="right" open={drawer.open} onClose={closeDrawer} sx={{ '& .MuiDrawer-paper': { width: 360 } }}>
          <Box p={2} display="flex" flexDirection="column" gap={2}>
            {drawer.appointment ? (
              <>
                <Box>
                  <Typography variant="h6">{drawer.appointment.customerName}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                    <Typography variant="body2">Staff:</Typography>
                    <Typography variant="body2">
                      {staff.find(s => s.id === drawer.appointment?.staffId)?.displayName || 'Unassigned'}
                    </Typography>
                  </Stack>
                  <Box mt={1}>
                    <Chip 
                      label={drawer.appointment.status.replace('_', ' ')} 
                      color={
                        drawer.appointment.status === 'confirmed' ? 'primary' :
                        drawer.appointment.status === 'new' ? 'info' :
                        drawer.appointment.status === 'completed' ? 'success' :
                        drawer.appointment.status === 'blocked' ? 'error' : 'default'
                      } 
                      size="small" 
                    />
                  </Box>
                  <Box mt={1}>
                    <Typography variant="body2">
                      {dayjs(`${selectedDate.toISOString().split('T')[0]}T${drawer.appointment.startTime}:00`).format('MMM D, YYYY h:mm A')} – {dayjs(`${selectedDate.toISOString().split('T')[0]}T${drawer.appointment.endTime}:00`).format('h:mm A')}
                    </Typography>
                  </Box>
                  {drawer.appointment.room && (
                    <Box mt={1}>
                      <Typography variant="body2">Room: {drawer.appointment.room}</Typography>
                    </Box>
                  )}
                  {drawer.appointment.price && (
                    <Box mt={1}>
                      <Typography variant="body2">Price: ${drawer.appointment.price}</Typography>
                    </Box>
                  )}
                </Box>

                <Divider />

                <Stack spacing={1}>
                  {drawer.appointment.status === 'confirmed' && (
                    <Button variant="contained" onClick={() => handleReservationAction('check_in')}>
                      Check-in
                    </Button>
                  )}
                  {drawer.appointment.status === 'new' && (
                    <Button variant="contained" color="info" onClick={() => handleReservationAction('check_in')}>
                      Start Service
                    </Button>
                  )}
                  {drawer.appointment.status === 'completed' && (
                    <Button variant="contained" color="success" disabled>
                      Completed
                    </Button>
                  )}
                  {drawer.appointment.status !== 'completed' && drawer.appointment.status !== 'blocked' && (
                    <Button variant="outlined" color="error" onClick={() => handleReservationAction('cancel')}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </>
            ) : (
              <Typography variant="body2">No selection</Typography>
            )}
          </Box>
        </Drawer>

      {/* Create Reservation Dialog */}
      <Dialog open={createDialog.open} onClose={() => setCreateDialog({ open: false })} maxWidth="md" fullWidth>
        <DialogTitle>New Reservation</DialogTitle>
        <DialogContent>
          <ReservationBookingForm
            onCreated={() => { 
              setCreateDialog({ open: false }); 
              loadSchedulingData(); 
            }}
            initialStart={createDialog.start}
            initialEmployeeId={createDialog.staffId ? parseInt(createDialog.staffId) : undefined}
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
    </Box>
  );
};
