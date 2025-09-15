import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Button } from '@mui/material';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation } from '../services/reservations';
import dayjs from 'dayjs';
import { Check, DirectionsRun, DoneAll, Logout } from '@mui/icons-material';

export const ReservationManagement: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const startOfDay = useMemo(() => dayjs().startOf('day').toISOString(), []);
  const endOfDay = useMemo(() => dayjs().endOf('day').toISOString(), []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await reservationsService.list({ start_time__gte: startOfDay, start_time__lte: endOfDay });
      setReservations(data);
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [startOfDay, endOfDay]);

  const handleAction = async (id: number, action: 'check_in' | 'in_service' | 'complete' | 'check_out') => {
    try {
      if (action === 'check_in') await reservationsService.checkIn(id);
      if (action === 'in_service') await reservationsService.inService(id);
      if (action === 'complete') await reservationsService.complete(id);
      if (action === 'check_out') await reservationsService.checkOut(id);
      await loadReservations();
    } catch (e) {
      console.error(`Failed to ${action} reservation`, e);
    }
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'primary';
      case 'checked_in':
      case 'in_service':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'default';
      default:
        return 'info';
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" mb={3}>Reservation Management</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Today's Calendar</Typography>
          <Box mb={2}>
            <Button variant="outlined" size="small" href="/reservations/explore">Open Reservations Explorer</Button>
          </Box>
          {loading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : (
            <Box>
              {reservations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No reservations scheduled for today.</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Guest</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Start time</TableCell>
                      <TableCell>End time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Total Duration</TableCell>
                      <TableCell>Total Price</TableCell>
                      <TableCell align="right">Manage</TableCell>
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
                        <TableCell>
                          <Chip label={(r.status ?? 'pending').replace('_', ' ')} color={statusColor(r.status) as any} size="small" />
                        </TableCell>
                        <TableCell>{r.total_duration_minutes ? `${r.total_duration_minutes} min` : '-'}</TableCell>
                        <TableCell>{typeof r.total_price === 'number' ? `$${r.total_price.toFixed(2)}` : '-'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Check-in"><span><IconButton size="small" onClick={() => handleAction(r.id, 'check_in')} disabled={r.status !== 'confirmed' && r.status !== 'pending'}><Check /></IconButton></span></Tooltip>
                          <Tooltip title="In service"><span><IconButton size="small" onClick={() => handleAction(r.id, 'in_service')} disabled={r.status !== 'checked_in'}><DirectionsRun /></IconButton></span></Tooltip>
                          <Tooltip title="Complete"><span><IconButton size="small" onClick={() => handleAction(r.id, 'complete')} disabled={r.status !== 'in_service'}><DoneAll /></IconButton></span></Tooltip>
                          <Tooltip title="Check-out"><span><IconButton size="small" onClick={() => handleAction(r.id, 'check_out')} disabled={r.status !== 'completed'}><Logout /></IconButton></span></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>New Reservation</Typography>
          <ReservationBookingForm />
        </CardContent>
      </Card>
    </Box>
  );
};


