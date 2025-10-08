import React from 'react';
import { Box, Paper, Typography, Grid, MenuItem, TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import { api } from '../services/api';

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const workTypes = ['Workday','Day Off'];
const timeOptions = Array.from({ length: 24 }, (_, h) => [h, '00']).concat(Array.from({ length: 24 }, (_, h) => [h, '30'])).map(([h, m]) => `${String(h).padStart(2, '0')}:${m}`);

export const EmployeeSchedules: React.FC = () => {
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<number | ''>('' as any);
  const [preservePto, setPreservePto] = React.useState(true);
  const [ignoreConflicts, setIgnoreConflicts] = React.useState(false);
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
                <Typography sx={{ lineHeight: '40px' }}>{row.day}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField select fullWidth size="small" value={row.type} onChange={(e) => updateRow(idx, 'type', e.target.value)} disabled={!selectedEmployeeId}>
                  {workTypes.map((wt) => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select fullWidth size="small" value={row.start} onChange={(e) => updateRow(idx, 'start', e.target.value)} disabled={!selectedEmployeeId}>
                  {timeOptions.map((t) => <MenuItem key={`s-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField select fullWidth size="small" value={row.end} onChange={(e) => updateRow(idx, 'end', e.target.value)} disabled={!selectedEmployeeId}>
                  {timeOptions.map((t) => <MenuItem key={`e-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField select fullWidth size="small" value={row.lunchStart} onChange={(e) => updateRow(idx, 'lunchStart', e.target.value)} disabled={!selectedEmployeeId}>
                  {timeOptions.map((t) => <MenuItem key={`ls-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField select fullWidth size="small" value={row.lunchEnd} onChange={(e) => updateRow(idx, 'lunchEnd', e.target.value)} disabled={!selectedEmployeeId}>
                  {timeOptions.map((t) => <MenuItem key={`le-${t}`} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={1}>
                <Button variant="text" size="small" onClick={() => copyPrevious(idx)} disabled={!selectedEmployeeId}>Copy Previous Day</Button>
              </Grid>
            </React.Fragment>
          ))}
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Update schedule starting the week of" value={"28 Sep - 4 Oct"} sx={{ minWidth: 220 }}>
            <MenuItem value={"28 Sep - 4 Oct"}>28 Sep - 4 Oct</MenuItem>
          </TextField>
          <FormControlLabel control={<Checkbox checked={preservePto} onChange={(e) => setPreservePto(e.target.checked)} />} label="Preserve Vacation and Personal days" />
        </Box>

        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          WARNING: Changing the default schedule will OVERRIDE all changes to weekly schedules on the selected week
        </Typography>

        <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={ignoreConflicts} onChange={(e) => setIgnoreConflicts(e.target.checked)} />} label="Ignore Schedule Conflicts" />

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button variant="outlined">Cancel</Button>
          <Button variant="contained" disabled={!selectedEmployeeId}>Save</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default EmployeeSchedules;


