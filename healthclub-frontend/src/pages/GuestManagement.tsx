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
import { guestPreferencesService } from '../services/guestPreferences';
import { guestCommunicationsService } from '../services/guestCommunications';
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

  const handleDeleteAddress = async (address: any) => {
    const next = addresses.filter((a: any) => a.id !== address.id);
    updateSelectedGuest((prev) => ({ ...prev, addresses: next }));
    if (selectedGuest) {
      try { await guestsService.update(selectedGuest.id, { addresses: next }); } catch (e) { console.error(e); }
    }
  };

  const handleSubmitAddress = async (values: any) => {
    let next = [] as any[];
    if (values.id) {
      next = addresses.map((a: any) => (a.id === values.id ? { ...a, ...values } : a));
    } else {
      const newItem = { ...values, id: Date.now() };
      next = [...addresses, newItem];
    }
    updateSelectedGuest((prev) => ({ ...prev, addresses: next }));
    setIsAddressDialogOpen(false);
    setEditingAddress(null);
    if (selectedGuest) {
      try { await guestsService.update(selectedGuest.id, { addresses: next }); } catch (e) { console.error(e); }
    }
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setIsContactDialogOpen(true);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setIsContactDialogOpen(true);
  };

  const handleDeleteContact = async (contact: any) => {
    const next = contacts.filter((c: any) => c.id !== contact.id);
    updateSelectedGuest((prev) => ({ ...prev, emergency_contacts: next }));
    if (selectedGuest) {
      try { await guestsService.update(selectedGuest.id, { emergency_contacts: next }); } catch (e) { console.error(e); }
    }
  };

  const handleSubmitContact = async (values: any) => {
    let next = [] as any[];
    if (values.id) {
      next = contacts.map((c: any) => (c.id === values.id ? { ...c, ...values } : c));
    } else {
      const newItem = { ...values, id: Date.now() };
      next = [...contacts, newItem];
    }
    updateSelectedGuest((prev) => ({ ...prev, emergency_contacts: next }));
    setIsContactDialogOpen(false);
    setEditingContact(null);
    if (selectedGuest) {
      try { await guestsService.update(selectedGuest.id, { emergency_contacts: next }); } catch (e) { console.error(e); }
    }
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
                onAdd={async () => {
                  if (!selectedGuest) return;
                  // Simple demo: add first service if exists
                  try {
                    const created = await guestPreferencesService.create(selectedGuest.id, { service: (preferences[0]?.service ?? 1), rating: 5 });
                    updateSelectedGuest((prev) => ({ ...prev, preferences: [...preferences, created] }));
                  } catch (e) { console.error(e); }
                }}
                onRemove={async (pref) => {
                  if (!selectedGuest) return;
                  updateSelectedGuest((prev) => ({ ...prev, preferences: preferences.filter((p: any) => p.id !== pref.id) }));
                  try { await guestPreferencesService.delete(selectedGuest.id, pref.id); } catch (e) { console.error(e); }
                }}
              />
              <CommunicationHistory
                communications={communications}
                onAdd={async () => {
                  if (!selectedGuest) return;
                  try {
                    const created = await guestCommunicationsService.create(selectedGuest.id, { communication_type: 'in_person', subject: 'Front Desk Note', message: 'Spoke with guest about preferences' });
                    updateSelectedGuest((prev) => ({ ...prev, communications: [created, ...communications] }));
                  } catch (e) { console.error(e); }
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
          // Toast then navigate
          navigate(`/reservations?guest=${selectedGuest?.id}`);
        }}
      />
    </Box>
  );
};
