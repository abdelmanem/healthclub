import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';

export const ReservationManagement: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" mb={3}>Reservation Management</Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>New Reservation</Typography>
          <ReservationBookingForm />
        </CardContent>
      </Card>
    </Box>
  );
};


