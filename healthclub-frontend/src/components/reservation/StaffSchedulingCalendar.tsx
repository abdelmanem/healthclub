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
  TextField,
} from '@mui/material';
import { api } from '../../services/api';

type Reservation = {
  id: number;
  guest_name: string;
  start_time: string;
  end_time: string;
  status: 'booked'|'checked_in'|'in_service'|'completed'|'cancelled';
  employee: number | null;
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
  const [workingHours, setWorkingHours] = React.useState<{ start: string; end: string }>({ start: '08:00:00', end: '22:00:00' });

  const loadData = React.useCallback(async () => {
    const [empRes, resRes] = await Promise.all([
      api.get('/employees/').catch(() => ({ data: { results: [] } })),
      api.get('/reservations/').catch(() => ({ data: { results: [] } })),
    ]);
    const emp = (empRes.data.results ?? empRes.data ?? []) as Employee[];
    const res = (resRes.data.results ?? resRes.data ?? []) as Reservation[];
    setEmployees(emp);
    setReservations(res);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

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
    extendedProps: { reservation: r },
  }));

  const handleSelect = async (info: any) => {
    try {
      const guest = window.prompt('Enter guest name for new reservation:');
      if (!guest) return;
      // Minimal create flow: backend normally expects more fields; here we demo assignment and times
      const body: any = {
        guest_name: guest,
        start_time: dayjs(info.start).toISOString(),
        end_time: dayjs(info.end).toISOString(),
        employee: info.resource?.id ? Number(info.resource.id) : null,
      };
      await api.post('/reservations/', body);
      await loadData();
    } catch (e) {
      console.error(e);
    }
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
      if (resource) body.employee = Number(resource.id);
      await api.patch(`/reservations/${r.id}/`, body);
      await loadData();
    } catch (e) {
      console.error('Failed to update reservation', e);
      dropInfo.revert();
    }
  };

  const openDrawer = (r: Reservation) => setDrawer({ open: true, reservation: r });
  const closeDrawer = () => setDrawer({ open: false, reservation: null });

  const act = async (action: 'check_in'|'in_service'|'complete'|'cancel') => {
    const r = drawer.reservation;
    if (!r) return;
    try {
      // Map actions to endpoints in reservations views (adjust to your API if different)
      const endpoint = action === 'check_in' ? 'check-in' : action === 'in_service' ? 'in-service' : action === 'complete' ? 'complete' : 'cancel';
      await api.post(`/reservations/${r.id}/${endpoint}/`, {});
      await loadData();
      closeDrawer();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <FullCalendar
        plugins={[resourceTimeGridPlugin as any, interactionPlugin]}
        initialView="resourceTimeGridDay"
        resources={resources}
        events={events}
        nowIndicator
        selectable
        selectMirror
        editable
        eventResourceEditable
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
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'resourceTimeGridDay,resourceTimeGridWeek' }}
        select={handleSelect}
        eventDrop={handleEventDrop}
        eventResize={handleEventDrop}
        eventClick={(arg:any) => {
          const r: Reservation | undefined = arg.event.extendedProps?.reservation;
          if (r) openDrawer(r);
        }}
        eventContent={(arg:any) => {
          const r: Reservation | undefined = arg.event.extendedProps?.reservation;
          const durationMin = r ? dayjs(r.end_time).diff(dayjs(r.start_time), 'minute') : (arg.event.end && arg.event.start ? dayjs(arg.event.end).diff(dayjs(arg.event.start), 'minute') : undefined);
          const title = arg.event.title || '';
          return { html: `<div style=\"padding:2px 4px;\"><div style=\"font-weight:600;\">${title}</div><div style=\"font-size:11px;opacity:.85\">${durationMin ?? ''} min</div></div>` };
        }}
        height="auto"
      />

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
                  <Button variant="contained" onClick={() => act('check_in')}>Check-in</Button>
                )}
                {drawer.reservation.status === 'checked_in' && (
                  <Button variant="contained" color="warning" onClick={() => act('in_service')}>Start Service</Button>
                )}
                {drawer.reservation.status === 'in_service' && (
                  <Button variant="contained" color="success" onClick={() => act('complete')}>Complete</Button>
                )}
                {drawer.reservation.status !== 'completed' && (
                  <Button variant="outlined" color="error" onClick={() => act('cancel')}>Cancel</Button>
                )}
              </Stack>
            </>
          ) : (
            <Typography variant="body2">No selection</Typography>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default StaffSchedulingCalendar;


