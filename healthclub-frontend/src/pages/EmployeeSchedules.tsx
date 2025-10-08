import React from 'react';
import { Box, Paper, Typography, Grid, MenuItem, TextField, Button, Checkbox, FormControlLabel, Alert } from '@mui/material';
import { api } from '../services/api';

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const workTypes = ['Workday','Day Off'];
const timeOptions = Array.from({ length: 24 }, (_, h) => [h, '00']).concat(Array.from({ length: 24 }, (_, h) => [h, '30'])).map(([h, m]) => `${String(h).padStart(2, '0')}:${m}`);

export const EmployeeSchedules: React.FC = () => {
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<number | ''>('' as any);
  const [preservePto, setPreservePto] = React.useState(true);
  const [ignoreConflicts, setIgnoreConflicts] = React.useState(false);
  const [alsoUpdateDefault, setAlsoUpdateDefault] = React.useState(false);
  const [status, setStatus] = React.useState<{type: 'success' | 'error'; msg: string} | null>(null);
  const [weekRefDate, setWeekRefDate] = React.useState<string>(() => {
    const d = new Date();
    // yyyy-mm-dd in local time
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [schedule, setSchedule] = React.useState(() => days.map((d) => ({
    day: d,
    type: 'Workday',
    start: '11:00',
    end: '23:00',
    lunchStart: '18:00',
    lunchEnd: '18:30',
  })));

  const updateRow = (idx: number, key: string, value: string) => {
    setSchedule((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const copyPrevious = (idx: number) => {
    if (idx <= 0) return;
    setSchedule((prev) => prev.map((row, i) => (i === idx ? { ...prev[i - 1], day: row.day } : row)));
  };

  const getWeekStartLocal = (ref: string) => {
    // ref is yyyy-mm-dd in local timezone
    const [y, m, d] = ref.split('-').map((v) => parseInt(v, 10));
    const date = new Date(y, m - 1, d);
    const day = date.getDay(); // 0..6, Sunday=0
    const start = new Date(date);
    start.setDate(date.getDate() - day); // move back to Sunday
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`; // date only
  };

  const getWeekEndLocal = (startIsoDateOnly: string) => {
    const [y, m, d] = startIsoDateOnly.split('-').map((v) => parseInt(v, 10));
    const start = new Date(y, m - 1, d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatRange = (startIso: string, endIso: string) => {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    };
    const startStr = fmt(startIso);
    const endStr = fmt(endIso);
    return `${startStr} - ${endStr}`;
  };

  const shiftWeek = (direction: -1 | 1) => {
    const start = getWeekStartLocal(weekRefDate);
    const [y, m, d] = start.split('-').map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (7 * direction));
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    // keep ref date as the new week start (so label remains correct and saves correctly)
    setWeekRefDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSave = async () => {
    setStatus(null);
    if (!selectedEmployeeId) return;
    const effectiveFrom = getWeekStartLocal(weekRefDate);
    try {
      // Load existing rows for this employee & week to avoid unique constraint errors (upsert)
      const existingRes = await api.get('/employee-weekly-schedules/', { params: { employee: Number(selectedEmployeeId), effective_from: effectiveFrom } }).catch(() => ({ data: [] }));
      const existing = (existingRes.data?.results ?? existingRes.data ?? []) as any[];
      const byDay: Record<number, any> = {};
      for (const r of existing) byDay[Number(r.day_of_week)] = r;

      const ensureSeconds = (t?: string | null) => {
        if (!t) return null as any;
        return t.length === 5 ? `${t}:00` : t; // HH:MM -> HH:MM:00
      };

      const payloads = schedule.map((row, idx) => {
        const isDayOff = row.type !== 'Workday';
        return {
          employee: Number(selectedEmployeeId),
          day_of_week: idx, // 0=Sunday
          is_day_off: isDayOff,
          start_time: isDayOff ? null : ensureSeconds(row.start),
          end_time: isDayOff ? null : ensureSeconds(row.end),
          lunch_start_time: isDayOff ? null : ensureSeconds(row.lunchStart),
          lunch_end_time: isDayOff ? null : ensureSeconds(row.lunchEnd),
          effective_from: effectiveFrom,
        };
      });
      // Upsert: patch if exists for that day, else create
      await Promise.all(payloads.map(async (p) => {
        const existingRow = byDay[p.day_of_week];
        if (existingRow && existingRow.id) {
          await api.patch(`/employee-weekly-schedules/${existingRow.id}/`, p);
        } else {
          await api.post('/employee-weekly-schedules/', p);
        }
      }));
      // Optionally mirror to default schedule (effective_from=null)
      if (alsoUpdateDefault) {
        const defaultRes = await api.get('/employee-weekly-schedules/', { params: { employee: Number(selectedEmployeeId), 'effective_from__isnull': 'true' } }).catch(() => ({ data: [] }));
        const defaults = (defaultRes.data?.results ?? defaultRes.data ?? []) as any[];
        const byDayDefault: Record<number, any> = {};
        for (const r of defaults) byDayDefault[Number(r.day_of_week)] = r;
        const defaultPayloads = schedule.map((row, idx) => {
          const isDayOff = row.type !== 'Workday';
          return {
            employee: Number(selectedEmployeeId),
            day_of_week: idx,
            is_day_off: isDayOff,
            start_time: isDayOff ? null : ensureSeconds(row.start),
            end_time: isDayOff ? null : ensureSeconds(row.end),
            lunch_start_time: isDayOff ? null : ensureSeconds(row.lunchStart),
            lunch_end_time: isDayOff ? null : ensureSeconds(row.lunchEnd),
            effective_from: null,
          } as any;
        });
        await Promise.all(defaultPayloads.map(async (p) => {
          const existingRow = byDayDefault[p.day_of_week];
          if (existingRow && existingRow.id) {
            await api.patch(`/employee-weekly-schedules/${existingRow.id}/`, p);
          } else {
            await api.post('/employee-weekly-schedules/', p);
          }
        }));
      }
      setStatus({ type: 'success', msg: 'Schedule saved.' });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to save schedule';
      setStatus({ type: 'error', msg });
    }
  };

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/employees/');
        setEmployees(res.data.results ?? res.data ?? []);
      } catch (e) {
        setEmployees([]);
      }
    })();
  }, []);

  // Load schedule for selected employee and current week; fallback to default
  React.useEffect(() => {
    const loadEmployeeWeek = async () => {
      if (!selectedEmployeeId) return;
      try {
        const effectiveFrom = getWeekStartLocal(weekRefDate);
        const [exactRes, defaultRes] = await Promise.all([
          api.get('/employee-weekly-schedules/', { params: { employee: Number(selectedEmployeeId), effective_from: effectiveFrom } }).catch(() => ({ data: [] })),
          api.get('/employee-weekly-schedules/', { params: { employee: Number(selectedEmployeeId), 'effective_from__isnull': 'true' } }).catch(() => ({ data: [] })),
        ]);
        const listA = (exactRes.data?.results ?? exactRes.data ?? []) as any[];
        const listB = (defaultRes.data?.results ?? defaultRes.data ?? []) as any[];
        const byDay: Record<number, any> = {};
        for (const r of listB) byDay[Number(r.day_of_week)] = r;
        for (const r of listA) byDay[Number(r.day_of_week)] = r;
        const toTime = (t?: string | null) => {
          if (!t) return '';
          const parts = String(t).split(':');
          return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
        };
        const newSchedule = days.map((_, idx) => {
          const row = byDay[idx];
          if (!row) return { day: days[idx], type: 'Workday', start: '11:00', end: '23:00', lunchStart: '18:00', lunchEnd: '18:30' };
          if (row.is_day_off) return { day: days[idx], type: 'Day Off', start: '11:00', end: '23:00', lunchStart: '18:00', lunchEnd: '18:30' };
          return { day: days[idx], type: 'Workday', start: toTime(row.start_time) || '11:00', end: toTime(row.end_time) || '23:00', lunchStart: toTime(row.lunch_start_time) || '18:00', lunchEnd: toTime(row.lunch_end_time) || '18:30' };
        });
        setSchedule(newSchedule);
      } catch {}
    };
    loadEmployeeWeek();
  }, [selectedEmployeeId, weekRefDate]);

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Employee Weekly Schedules</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <TextField
          select
          size="small"
          label="Select Employee"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(Number(e.target.value) as any)}
          sx={{ minWidth: 280 }}
        >
          <MenuItem value="">Select...</MenuItem>
          {employees.map((emp: any) => (
            <MenuItem key={emp.id} value={emp.id}>
              {(emp.full_name ?? (`${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim())) || `Employee #${emp.id}`}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Paper sx={{ p: 2 }}>
        {status && (
          <Alert severity={status.type} sx={{ mb: 2 }}>{status.msg}</Alert>
        )}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Week 1</Typography>
        <Grid container spacing={1} sx={{ fontSize: '0.9rem' }}>
          <Grid item xs={12} md={3} sx={{ fontWeight: 600 }}>Day</Grid>
          <Grid item xs={12} md={2} sx={{ fontWeight: 600 }}>Type</Grid>
          <Grid item xs={6} md={2} sx={{ fontWeight: 600 }}>Start Time</Grid>
          <Grid item xs={6} md={2} sx={{ fontWeight: 600 }}>End Time</Grid>
          <Grid item xs={6} md={1} sx={{ fontWeight: 600 }}>Lunch Start</Grid>
          <Grid item xs={6} md={1} sx={{ fontWeight: 600 }}>Lunch End</Grid>
          <Grid item xs={12} md={1} sx={{ fontWeight: 600 }}></Grid>

          {schedule.map((row, idx) => (
            <React.Fragment key={row.day}>
              <Grid item xs={12} md={3}>
                <Typography sx={{ lineHeight: '40px', opacity: row.type === 'Day Off' ? 0.6 : 1 }}>{row.day}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField select fullWidth size="small" value={row.type} onChange={(e) => updateRow(idx, 'type', e.target.value)} disabled={!selectedEmployeeId}>
                  {workTypes.map((wt) => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select fullWidth size="small" value={row.start} onChange={(e) => updateRow(idx, 'start', e.target.value)} disabled={!selectedEmployeeId || row.type === 'Day Off'} sx={{ opacity: row.type === 'Day Off' ? 0.5 : 1 }}>
                  {timeOptions.map((t) => <MenuItem key={`s-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select fullWidth size="small" value={row.end} onChange={(e) => updateRow(idx, 'end', e.target.value)} disabled={!selectedEmployeeId || row.type === 'Day Off'} sx={{ opacity: row.type === 'Day Off' ? 0.5 : 1 }}>
                  {timeOptions.map((t) => <MenuItem key={`e-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField select fullWidth size="small" value={row.lunchStart} onChange={(e) => updateRow(idx, 'lunchStart', e.target.value)} disabled={!selectedEmployeeId || row.type === 'Day Off'} sx={{ opacity: row.type === 'Day Off' ? 0.5 : 1 }}>
                  {timeOptions.map((t) => <MenuItem key={`ls-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField select fullWidth size="small" value={row.lunchEnd} onChange={(e) => updateRow(idx, 'lunchEnd', e.target.value)} disabled={!selectedEmployeeId || row.type === 'Day Off'} sx={{ opacity: row.type === 'Day Off' ? 0.5 : 1 }}>
                  {timeOptions.map((t) => <MenuItem key={`le-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={1}>
                <Button variant="text" size="small" onClick={() => copyPrevious(idx)} disabled={!selectedEmployeeId || row.type === 'Day Off'}>Copy Previous Day</Button>
              </Grid>
            </React.Fragment>
          ))}
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          {(() => {
            const weekStart = getWeekStartLocal(weekRefDate);
            const weekEnd = getWeekEndLocal(weekStart);
            const label = `Update schedule starting the week of`;
            const display = formatRange(weekStart, weekEnd);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  label={label}
                  value={display}
                  InputProps={{ readOnly: true }}
                />
                <Button variant="outlined" size="small" onClick={() => shiftWeek(-1)}>Previous</Button>
                <Button variant="outlined" size="small" onClick={() => shiftWeek(1)}>Next</Button>
              </Box>
            );
          })()}
          <FormControlLabel control={<Checkbox checked={preservePto} onChange={(e) => setPreservePto(e.target.checked)} />} label="Preserve Vacation and Personal days" />
          <FormControlLabel control={<Checkbox checked={alsoUpdateDefault} onChange={(e) => setAlsoUpdateDefault(e.target.checked)} />} label="Also update default template" />
        </Box>

        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          WARNING: Changing the default schedule will OVERRIDE all changes to weekly schedules on the selected week
        </Typography>

        <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={ignoreConflicts} onChange={(e) => setIgnoreConflicts(e.target.checked)} />} label="Ignore Schedule Conflicts" />

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={() => { setStatus(null); }}>Cancel</Button>
          <Button variant="contained" disabled={!selectedEmployeeId} onClick={handleSave}>Save</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default EmployeeSchedules;


