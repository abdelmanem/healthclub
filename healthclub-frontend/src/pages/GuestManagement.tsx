import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { GuestSearch } from '../components/guest/GuestSearch';
import { PermissionGate } from '../components/common/PermissionGate';
import { GuestProfile } from '../components/guest/GuestProfile';
import { CreateGuestDialog } from '../components/guest/CreateGuestDialog';
import { EditGuestDialog } from '../components/guest/EditGuestDialog';
import { PreferenceManager } from '../components/guest/advanced/PreferenceManager';
import { CommunicationHistory } from '../components/guest/advanced/CommunicationHistory';
import { AddressList } from '../components/guest/AddressList';
import { EmergencyContactList } from '../components/guest/EmergencyContactList';
import { guestsService, Guest as GuestType } from '../services/guests';

type Guest = GuestType;

export const GuestManagement: React.FC = () => {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleGuestSelect = (guest: Guest) => {
    setSelectedGuest(guest);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Guest Management
        </Typography>
        <PermissionGate permission="add" model="guests">
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsCreateOpen(true)}
          >
            Add Guest
          </Button>
        </PermissionGate>
      </Box>

      <Box
        display="grid"
        gap={3}
        gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
      >
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search Guests
              </Typography>
              <GuestSearch onGuestSelect={handleGuestSelect} />
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Guest Details
              </Typography>
              {selectedGuest ? (
                <GuestProfile
                  guest={selectedGuest}
                  onEdit={() => setIsEditOpen(true)}
                  onViewReservations={() => {
                    // TODO: navigate to reservations page filtered by guest
                    console.log('View reservations for guest', selectedGuest?.id);
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select a guest from the search results to view details
                </Typography>
              )}
            </CardContent>
          </Card>
          {selectedGuest && (
            <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
              <PreferenceManager preferences={(selectedGuest as any).preferences} />
              <CommunicationHistory communications={(selectedGuest as any).communications} />
              <AddressList addresses={(selectedGuest as any).addresses} />
              <EmergencyContactList contacts={(selectedGuest as any).emergency_contacts} />
            </Box>
          )}
        </Box>
      </Box>

      <CreateGuestDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(guest) => {
          setSelectedGuest(guest);
          setIsCreateOpen(false);
        }}
      />

      <EditGuestDialog
        open={isEditOpen}
        guest={selectedGuest}
        onClose={() => setIsEditOpen(false)}
        onUpdated={(guest) => setSelectedGuest(guest)}
      />
    </Box>
  );
};
