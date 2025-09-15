import React, { useMemo, useState } from 'react';
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
import { CreateAddressDialog } from '../components/guest/CreateAddressDialog';
import { CreateEmergencyContactDialog } from '../components/guest/CreateEmergencyContactDialog';
import { guestsService, Guest as GuestType } from '../services/guests';
import { useNavigate } from 'react-router-dom';
import { QuickReservationDialog } from '../components/guest/QuickReservationDialog';


type Guest = GuestType;

export const GuestManagement: React.FC = () => {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const navigate = useNavigate();

  const handleGuestSelect = (guest: Guest) => {
    setSelectedGuest(guest);
  };

  const addresses = useMemo(() => (selectedGuest as any)?.addresses ?? [], [selectedGuest]);
  const contacts = useMemo(() => (selectedGuest as any)?.emergency_contacts ?? [], [selectedGuest]);
  const preferences = useMemo(() => (selectedGuest as any)?.preferences ?? [], [selectedGuest]);
  const communications = useMemo(() => (selectedGuest as any)?.communications ?? [], [selectedGuest]);

  const updateSelectedGuest = (updater: (prev: any) => any) => {
    setSelectedGuest((prev) => (prev ? updater(prev) : prev));
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setIsAddressDialogOpen(true);
  };

  const handleEditAddress = (address: any) => {
    setEditingAddress(address);
    setIsAddressDialogOpen(true);
  };

  const handleDeleteAddress = (address: any) => {
    updateSelectedGuest((prev) => ({
      ...prev,
      addresses: addresses.filter((a: any) => a.id !== address.id),
    }));
  };

  const handleSubmitAddress = (values: any) => {
    if (values.id) {
      updateSelectedGuest((prev) => ({
        ...prev,
        addresses: addresses.map((a: any) => (a.id === values.id ? { ...a, ...values } : a)),
      }));
    } else {
      const newItem = { ...values, id: Date.now() };
      updateSelectedGuest((prev) => ({
        ...prev,
        addresses: [...addresses, newItem],
      }));
    }
    setIsAddressDialogOpen(false);
    setEditingAddress(null);
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setIsContactDialogOpen(true);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setIsContactDialogOpen(true);
  };

  const handleDeleteContact = (contact: any) => {
    updateSelectedGuest((prev) => ({
      ...prev,
      emergency_contacts: contacts.filter((c: any) => c.id !== contact.id),
    }));
  };

  const handleSubmitContact = (values: any) => {
    if (values.id) {
      updateSelectedGuest((prev) => ({
        ...prev,
        emergency_contacts: contacts.map((c: any) => (c.id === values.id ? { ...c, ...values } : c)),
      }));
    } else {
      const newItem = { ...values, id: Date.now() };
      updateSelectedGuest((prev) => ({
        ...prev,
        emergency_contacts: [...contacts, newItem],
      }));
    }
    setIsContactDialogOpen(false);
    setEditingContact(null);
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
                  onViewReservations={() => navigate(`/reservations?guest=${selectedGuest?.id}`)}
                  onQuickReserve={() => setIsQuickResOpen(true)}
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
              <PreferenceManager
                preferences={preferences}
                onAdd={() => {
                  // Stub: open a preference add flow (not implemented)
                }}
                onRemove={(pref) => {
                  updateSelectedGuest((prev) => ({
                    ...prev,
                    preferences: preferences.filter((p: any) => p.id !== pref.id),
                  }));
                }}
              />
              <CommunicationHistory
                communications={communications}
                onAdd={() => {
                  // Stub: open a communication compose flow (not implemented)
                }}
              />
              <AddressList
                addresses={addresses}
                onAdd={handleAddAddress}
                onEdit={handleEditAddress}
                onDelete={handleDeleteAddress}
              />
              <EmergencyContactList
                contacts={contacts}
                onAdd={handleAddContact}
                onEdit={handleEditContact}
                onDelete={handleDeleteContact}
              />
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

      <CreateAddressDialog
        open={isAddressDialogOpen}
        initialValue={editingAddress}
        onClose={() => { setIsAddressDialogOpen(false); setEditingAddress(null); }}
        onSubmit={handleSubmitAddress}
      />

      <CreateEmergencyContactDialog
        open={isContactDialogOpen}
        initialValue={editingContact}
        onClose={() => { setIsContactDialogOpen(false); setEditingContact(null); }}
        onSubmit={handleSubmitContact}
      />

      <QuickReservationDialog
        open={isQuickResOpen}
        guestId={selectedGuest?.id ?? null}
        onClose={() => setIsQuickResOpen(false)}
        onCreated={(id) => {
          // Optionally navigate or toast
        }}
      />
    </Box>
  );
};
