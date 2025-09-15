import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent, TextField, MenuItem, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import dayjs from 'dayjs';
import { reservationsService, Reservation } from '../services/reservations';
import { api } from '../services/api';

interface Location { id: number; name: string; }

export const ReservationsExplorer: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [status, setStatus] = useState<string>('');
  const [location, setLocation] = useState<number | ''>('');
  const [search, setSearch] = useState<string>('');
  const [from, setFrom] = useState<string>(dayjs().startOf('day').format('YYYY-MM-DD'));
  const [to, setTo] = useState<string>(dayjs().endOf('day').format('YYYY-MM-DD'));

  const params = useMemo(() => {
    const p: any = {};
    if (status) p.status = status;
    if (location) p.location = location;
    if (from) p.start_time__gte = dayjs(from).startOf('day').toISOString();
    if (to) p.start_time__lte = dayjs(to).endOf('day').toISOString();
    if (search) p.search = search;
    return p;
  }, [status, location, from, to, search]);

  useEffect(() => {
    const load = async () => {
      try {
        const [locs, res] = await Promise.all([
          api.get('/locations/').then(r => Array.isArray(r.data) ? r.data : r.data.results || []),
          reservationsService.list(params),
        ]);
        setLocations(locs);
        setReservations(res);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [params]);

  const statusColor = (s?: string) => s === 'confirmed' ? 'primary' : s === 'in_service' || s === 'checked_in' ? 'warning' : s === 'completed' ? 'success' : s === 'cancelled' ? 'default' : 'info';

  return (
    <Box>
      <Typography variant="h4" component="h1" mb={3}>Reservations Explorer</Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(5, 1fr)' }} gap={2}>
            <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="checked_in">Checked in</MenuItem>
              <MenuItem value="in_service">In service</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField select label="Location" value={location} onChange={(e) => setLocation(e.target.value as any)}>
              <MenuItem value="">All</MenuItem>
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Search guest/notes" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Price</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.guest_name ?? r.guest}</TableCell>
                  <TableCell>{r.location_name ?? r.location ?? '-'}</TableCell>
                  <TableCell>{dayjs(r.start_time).format('MMM D, YYYY, h:mm A')}</TableCell>
                  <TableCell>{r.end_time ? dayjs(r.end_time).format('MMM D, YYYY, h:mm A') : '-'}</TableCell>
                  <TableCell><Chip label={(r.status ?? 'pending').replace('_',' ')} color={statusColor(r.status) as any} size="small" /></TableCell>
                  <TableCell>{r.total_duration_minutes ? `${r.total_duration_minutes} min` : '-'}</TableCell>
                  <TableCell>{typeof r.total_price === 'number' ? `$${r.total_price.toFixed(2)}` : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};
