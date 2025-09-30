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
} from '@mui/material';
import { ReservationBookingForm } from './ReservationBookingForm';
import { api } from '../../services/api';

type Reservation = {
  id: number;
  guest: number;
  guest_name: string;
  start_time: string;
  end_time: string;
  status: 'booked'|'checked_in'|'in_service'|'completed'|'cancelled';
  employee: number | null;
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
  const [workingHours, setWorkingHours] = React.useState<{ start: string; end: string }>({ start: '08:00:00', end: '22:00:00' });
  const firstReservationIdSet = React.useMemo(() => {
    const map: Record<number, { id: number; start: string }> = {};
    for (const r of reservations) {
      const g = (r as any).guest;
      if (!g) continue;
      const existing = map[g];
      if (!existing || dayjs(r.start_time).isBefore(existing.start)) {
        map[g] = { id: r.id, start: r.start_time };
      }
    }
    const ids = new Set<number>();
    Object.values(map).forEach(v => ids.add(v.id));
    return ids;
  }, [reservations]);
  const [createDialog, setCreateDialog] = React.useState<{ open: boolean; start?: string; employeeId?: number; locationId?: number }>({ open: false });

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
    extendedProps: {
      reservation: r,
      isFirst: firstReservationIdSet.has(r.id),
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

  const handleSelect = (info: any) => {
    setCreateDialog({
      open: true,
      start: dayjs(info.start).toISOString(),
      employeeId: info.resource?.id ? Number(info.resource.id) : undefined,
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
          const primaryForReservation = allAssignments.filter((a) => a.reservation === r.id && a.role_in_service === 'Primary');
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
              role_in_service: 'Primary',
            });
          }
        } catch (assignErr: any) {
          console.warn('Employee reassignment failed:', assignErr);
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
          const ev = arg.event;
          const start = ev.start ? dayjs(ev.start).format('h:mm A') : '';
          const end = ev.end ? dayjs(ev.end).format('h:mm A') : '';
          const title = ev.title || '';
          const isFirst = !!(ev.extendedProps && ev.extendedProps.isFirst);
          const servicesText = (ev.extendedProps && ev.extendedProps.servicesText) || '';
          const totalDurationMin = (ev.extendedProps && ev.extendedProps.totalDurationMin) as number | undefined;
          const badge = isFirst ? '<span style="margin-left:6px;padding:1px 4px;border-radius:3px;background:#fff;color:#000;font-size:10px;font-weight:700;">New</span>' : '';
          const html = `
            <div style="padding:3px 4px;line-height:1.15;">
              <div style="font-size:11px;opacity:.95;">${start}</div>
              <div style="font-weight:700;font-size:12px;display:flex;align-items:center;">${title}${badge}</div>
              ${servicesText ? `<div style=\"font-size:11px;opacity:.95;\">${servicesText}</div>` : ''}
              ${typeof totalDurationMin === 'number' ? `<div style=\"font-size:11px;opacity:.95;\"><strong>Total Duration:</strong> ${totalDurationMin} min</div>` : ''}
              <div style="font-size:11px;opacity:.95;">${end}</div>
            </div>`;
          return { html };
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
    </Box>
  );
};

export default StaffSchedulingCalendar;


