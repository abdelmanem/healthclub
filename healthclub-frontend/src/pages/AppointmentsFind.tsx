import React from 'react';
import { Box, Card, CardContent, Typography, TextField, MenuItem, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, Pagination } from '@mui/material';
import dayjs from 'dayjs';
import { reservationsService, Reservation } from '../services/reservations';

export const AppointmentsFind: React.FC = () => {
  const [items, setItems] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [guest, setGuest] = React.useState<string>('');
  const [employee, setEmployee] = React.useState<string>('');
  const [location, setLocation] = React.useState<string>('');
  const [status, setStatus] = React.useState<string>('');
  const [startDate, setStartDate] = React.useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = React.useState<string>(dayjs().endOf('month').format('YYYY-MM-DD'));

  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        start_time__gte: startDate,
        start_time__lte: endDate,
      };
      if (guest) params.guest = Number(guest) || undefined;
      if (employee) params.employee = Number(employee) || undefined;
      if (location) params.location = Number(location) || undefined;
      if (status) params.status = status;
      const data = await reservationsService.list(params);
      setItems(Array.isArray(data) ? data : (data as any).results ?? data ?? []);
    } catch (e) {
      console.error(e);
      setError('Failed to load appointments');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, guest, employee, location, status]);

  React.useEffect(() => { load(); }, [load]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page]);

  return (
    <Box p={2}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Find Appointments</Typography>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
            <TextField label="Guest ID" value={guest} onChange={(e) => setGuest(e.target.value)} size="small" />
            <TextField label="Employee ID" value={employee} onChange={(e) => setEmployee(e.target.value)} size="small" />
            <TextField label="Location ID" value={location} onChange={(e) => setLocation(e.target.value)} size="small" />
            <TextField label="Status" select value={status} onChange={(e) => setStatus(e.target.value)} size="small">
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="booked">Booked</MenuItem>
              <MenuItem value="checked_in">Checked In</MenuItem>
              <MenuItem value="in_service">In Service</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="checked_out">Checked Out</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
            <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          </Box>
          <Stack direction="row" spacing={1} mt={2}>
            <Button variant="contained" onClick={load} disabled={loading}>Search</Button>
            <Button variant="text" onClick={() => { setGuest(''); setEmployee(''); setLocation(''); setStatus(''); setStartDate(dayjs().startOf('month').format('YYYY-MM-DD')); setEndDate(dayjs().endOf('month').format('YYYY-MM-DD')); setPage(1); }}>Reset</Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Typography color="error" variant="body2" mb={2}>{error}</Typography>
      )}

      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.guest_name ?? `Guest #${r.guest}`}</TableCell>
                  <TableCell>{r.employee_name ?? (r.employee ? `#${r.employee}` : '—')}</TableCell>
                  <TableCell>{r.location_name ?? (r.location ? `#${r.location}` : '—')}</TableCell>
                  <TableCell>{dayjs(r.start_time).format('MMM D, YYYY h:mm A')}</TableCell>
                  <TableCell>{r.end_time ? dayjs(r.end_time).format('h:mm A') : '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={(r.status ?? '').replace('_',' ')} color={
                      r.status === 'booked' ? 'primary' :
                      r.status === 'checked_in' ? 'warning' :
                      r.status === 'in_service' ? 'warning' :
                      r.status === 'completed' ? 'success' :
                      r.status === 'cancelled' ? 'error' : 'default'
                    } />
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">{loading ? 'Loading…' : 'No appointments found'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Pagination count={Math.max(1, Math.ceil(items.length / pageSize))} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AppointmentsFind;


