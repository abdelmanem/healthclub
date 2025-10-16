/**
 * ReservationActions Component
 * 
 * Action buttons for reservation management including check-out
 */

import React, { useState } from 'react';
import {
  Button,
  Stack,
  Chip,
  Box,
} from '@mui/material';
import {
  Login,
  PlayArrow,
  CheckCircle,
  Logout,
  Cancel,
} from '@mui/icons-material';
import { CheckOutDialog } from './CheckOutDialog';
import { reservationsService, Reservation } from '../../services/reservations';

interface ReservationActionsProps {
  reservation: Reservation;
  onStatusChange: () => void;
  onInvoiceCreated?: (invoiceId: number) => void;
}

export const ReservationActions: React.FC<ReservationActionsProps> = ({
  reservation,
  onStatusChange,
  onInvoiceCreated,
}) => {
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleStatusChange = async (action: string) => {
    setProcessing(true);
    try {
      switch (action) {
        case 'check-in':
          await reservationsService.checkIn(reservation.id);
          break;
        case 'in-service':
          await reservationsService.inService(reservation.id);
          break;
        case 'complete':
          await reservationsService.complete(reservation.id);
          break;
        case 'cancel':
          await reservationsService.cancel(reservation.id);
          break;
      }
      onStatusChange();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Failed to ${action} reservation`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOutSuccess = () => {
    onStatusChange();
    setCheckOutDialogOpen(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
      booked: 'default',
      checked_in: 'info',
      in_service: 'primary',
      completed: 'success',
      checked_out: 'secondary',
      cancelled: 'error',
      no_show: 'warning',
    };
    return colors[status] || 'default';
  };

  const getAvailableActions = () => {
    const actions = [];
    
    switch (reservation.status) {
      case 'booked':
        actions.push(
          <Button
            key="check-in"
            variant="outlined"
            size="small"
            startIcon={<Login />}
            onClick={() => handleStatusChange('check-in')}
            disabled={processing}
          >
            Check In
          </Button>,
          <Button
            key="cancel"
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Cancel />}
            onClick={() => handleStatusChange('cancel')}
            disabled={processing}
          >
            Cancel
          </Button>
        );
        break;
        
      case 'checked_in':
        actions.push(
          <Button
            key="in-service"
            variant="outlined"
            size="small"
            startIcon={<PlayArrow />}
            onClick={() => handleStatusChange('in-service')}
            disabled={processing}
          >
            Start Service
          </Button>,
          <Button
            key="cancel"
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Cancel />}
            onClick={() => handleStatusChange('cancel')}
            disabled={processing}
          >
            Cancel
          </Button>
        );
        break;
        
      case 'in_service':
        actions.push(
          <Button
            key="complete"
            variant="outlined"
            size="small"
            startIcon={<CheckCircle />}
            onClick={() => handleStatusChange('complete')}
            disabled={processing}
          >
            Complete
          </Button>
        );
        break;
        
      case 'completed':
        actions.push(
          <Button
            key="check-out"
            variant="contained"
            size="small"
            startIcon={<Logout />}
            onClick={() => setCheckOutDialogOpen(true)}
            disabled={processing}
          >
            Check Out
          </Button>
        );
        break;
        
      case 'checked_out':
        // No actions available for checked out reservations
        break;
        
      case 'cancelled':
        // No actions available for cancelled reservations
        break;
    }
    
    return actions;
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          label={reservation.status?.replace('_', ' ').toUpperCase()}
          color={getStatusColor(reservation.status || 'booked')}
          size="small"
        />
        
        <Stack direction="row" spacing={1}>
          {getAvailableActions()}
        </Stack>
      </Box>

      {/* Check Out Dialog */}
      <CheckOutDialog
        open={checkOutDialogOpen}
        onClose={() => setCheckOutDialogOpen(false)}
        reservation={{
          id: reservation.id,
          guest_name: reservation.guest_name || `Guest #${reservation.guest}`,
          location_name: reservation.location_name,
          status: reservation.status || 'booked',
          total_price: reservation.total_price?.toString(),
          services: reservation.reservation_services?.map(rs => ({
            service_name: rs.service_details?.name || `Service #${rs.service}`,
            quantity: rs.quantity,
            unit_price: rs.unit_price,
          })),
        }}
        onCheckOutSuccess={handleCheckOutSuccess}
      />
    </>
  );
};
