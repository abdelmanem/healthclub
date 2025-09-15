import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { LoyaltyProgramManager } from './advanced/LoyaltyProgramManager';
import { Person } from '@mui/icons-material';
import { Guest } from '../../services/guests';
import { PermissionGate } from '../common/PermissionGate';

interface GuestProfileProps {
  guest: Guest;
  onEdit?: () => void;
  onViewReservations?: () => void;
  onQuickReserve?: () => void;
}

export const GuestProfile: React.FC<GuestProfileProps> = ({ guest, onEdit, onViewReservations, onQuickReserve }) => {
  return (
    <Box>
      <Box display="flex" alignItems="center" mb={2}>
        <Person sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">
          {guest.first_name} {guest.last_name}
        </Typography>
      </Box>

      <Box mb={2}>
        <Typography variant="body2" color="text.secondary">
          Email: {guest.email}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Phone: {guest.phone}
        </Typography>
        {guest.membership_tier && (
          <Box mt={1}>
            <Chip label={typeof guest.membership_tier === 'string' ? guest.membership_tier : guest.membership_tier.display_name} color="primary" size="small" />
          </Box>
        )}
      </Box>

      <Box mb={2}>
        <LoyaltyProgramManager
          loyalty_points={(guest as any).loyalty_points}
          membership_tier={typeof guest.membership_tier === 'string' ? guest.membership_tier : guest.membership_tier?.display_name}
          benefits={(guest as any).membership_benefits}
        />
      </Box>

      <Box display="flex" gap={1}>
        <PermissionGate permission="change" model="guests">
          <Button variant="outlined" size="small" onClick={onEdit}>Edit Guest</Button>
        </PermissionGate>
        <PermissionGate permission="view" model="reservations">
          <Button variant="outlined" size="small" onClick={onViewReservations}>View Reservations</Button>
        </PermissionGate>
        <PermissionGate permission="add" model="reservations">
          <Button variant="contained" size="small" color="primary" onClick={onQuickReserve}>Quick Reserve</Button>
        </PermissionGate>
      </Box>
    </Box>
  );
};


