/**
 * ReservationStatusDemo Component
 * 
 * Demo component to show the reservation status workflow and actions
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import { ReservationActions } from './ReservationActions';
import { Reservation } from '../../services/reservations';

export const ReservationStatusDemo: React.FC = () => {
  const [reservation, setReservation] = useState<Reservation>({
    id: 1,
    guest: 1,
    guest_name: 'John Doe',
    location_name: 'Room 101',
    status: 'booked',
    start_time: '2025-01-15T10:00:00Z',
    end_time: '2025-01-15T11:00:00Z',
    total_price: 100,
    reservation_services: [
      {
        id: 1,
        service: 1,
        service_details: {
          id: 1,
          name: 'Swedish Massage',
          description: 'Relaxing full body massage',
          duration_minutes: 60,
          price: '100.00',
          category: 'Massage',
        },
        quantity: 1,
        unit_price: '100.00',
        total_price: '100.00',
        service_duration_minutes: 60,
      },
    ],
  });

  const handleStatusChange = () => {
    // Simulate status progression
    const statusFlow = ['booked', 'checked_in', 'in_service', 'completed', 'checked_out'];
    const currentIndex = statusFlow.indexOf(reservation.status || 'booked');
    const nextIndex = Math.min(currentIndex + 1, statusFlow.length - 1);
    
    setReservation(prev => ({
      ...prev,
      status: statusFlow[nextIndex] as any,
    }));
  };

  const resetReservation = () => {
    setReservation(prev => ({
      ...prev,
      status: 'booked',
    }));
  };

  const getStatusDescription = (status: string) => {
    const descriptions: Record<string, string> = {
      booked: 'Reservation is booked and waiting for guest arrival',
      checked_in: 'Guest has arrived and checked in',
      in_service: 'Service is currently in progress',
      completed: 'Service has been completed - ready for check-out',
      checked_out: 'Guest has checked out - room needs cleaning',
      cancelled: 'Reservation was cancelled',
    };
    return descriptions[status] || 'Unknown status';
  };

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Reservation Status Workflow Demo
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Current Reservation Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Current Reservation
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">ID:</Typography>
              <Typography variant="body2">#{reservation.id}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Guest:</Typography>
              <Typography variant="body2">{reservation.guest_name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Location:</Typography>
              <Typography variant="body2">{reservation.location_name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Service:</Typography>
              <Typography variant="body2">
                {reservation.reservation_services?.[0]?.service_details?.name || 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Total:</Typography>
              <Typography variant="body2" fontWeight={600}>
                ${reservation.total_price?.toFixed(2)}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Status Description */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Current Status:
          </Typography>
          <Typography variant="body2">
            {getStatusDescription(reservation.status || 'booked')}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Available Actions
          </Typography>
          <ReservationActions
            reservation={reservation}
            onStatusChange={handleStatusChange}
          />
        </Box>

        {/* Demo Controls */}
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="h6" gutterBottom>
            Demo Controls
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handleStatusChange}
              disabled={reservation.status === 'checked_out'}
            >
              Next Status
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={resetReservation}
            >
              Reset to Booked
            </Button>
          </Stack>
        </Box>

        {/* Status Flow Visualization */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Status Flow
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {['booked', 'checked_in', 'in_service', 'completed', 'checked_out'].map((status, index) => (
              <Box key={status} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={status.replace('_', ' ').toUpperCase()}
                  color={
                    status === reservation.status ? 'primary' :
                    ['booked', 'checked_in', 'in_service', 'completed'].indexOf(status) <= 
                    ['booked', 'checked_in', 'in_service', 'completed'].indexOf(reservation.status || 'booked') 
                      ? 'success' : 'default'
                  }
                  size="small"
                />
                {index < 4 && (
                  <Typography variant="body2" sx={{ mx: 1 }}>
                    →
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};
