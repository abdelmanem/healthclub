import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation } from '../services/reservations';
import dayjs from 'dayjs';

export const ReservationManagement: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const startOfDay = useMemo(() => dayjs().startOf('day').toISOString(), []);
  const endOfDay = useMemo(() => dayjs().endOf('day').toISOString(), []);

  useEffect(() => {
    const load = async () => {
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
    load();
  }, [startOfDay, endOfDay]);

  return (
    <Box>
      <Typography variant="h4" component="h1" mb={3}>Reservation Management</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Today&apos;s Calendar</Typography>
          {/* Simple timeline list for today; can be upgraded to full calendar later */}
          {loading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : (
            <Box display="grid" gap={1}>
              {reservations.length === 0 && (
                <Typography variant="body2" color="text.secondary">No reservations scheduled for today.</Typography>
              )}
              {reservations.map((r) => (
                <Box key={r.id} display="flex" alignItems="center" justifyContent="space-between" p={1} borderRadius={1} sx={{ bgcolor: 'grey.50' }}>
                  <Box>
                    <Typography variant="body1">{dayjs(r.start_time).format('HH:mm')} - {dayjs(r.end_time || r.start_time).format('HH:mm')}</Typography>
                    <Typography variant="body2" color="text.secondary">Reservation #{r.id}</Typography>
                  </Box>
                  <Chip label={(r.status ?? 'pending').replace('_',' ')} color={
                    r.status === 'confirmed' ? 'primary' :
                    r.status === 'checked_in' || r.status === 'in_service' ? 'warning' :
                    r.status === 'completed' ? 'success' :
                    r.status === 'cancelled' ? 'default' : 'info'
                  } size="small" />
                </Box>
              ))}
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


