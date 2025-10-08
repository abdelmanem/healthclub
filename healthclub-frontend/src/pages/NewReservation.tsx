import React from 'react';
import { Box, DialogContent, DialogTitle } from '@mui/material';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { useNavigate } from 'react-router-dom';

export const NewReservation: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%', backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
      <DialogTitle>New Reservation</DialogTitle>
      <DialogContent>
        <ReservationBookingForm
          onCreated={() => {
            navigate('/reservations');
          }}
          onClose={() => navigate('/reservations')}
        />
      </DialogContent>
    </Box>
  );
};

export default NewReservation;

