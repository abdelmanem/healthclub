import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider
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
import { GuestJourneyTracker } from '../components/guest/advanced/GuestJourneyTracker';
import { GuestRetentionTracker } from '../components/guest/advanced/GuestRetentionTracker';
import { GuestSegmentation } from '../components/guest/advanced/GuestSegmentation';
import { LoyaltyProgramManager } from '../components/guest/advanced/LoyaltyProgramManager';
import { GuestAnalytics } from '../components/guest/advanced/GuestAnalytics';
import { GuestFeedbackManager } from '../components/guest/advanced/GuestFeedbackManager';
import { guestsService, Guest as GuestType } from '../services/guests';
import { guestPreferencesService } from '../services/guestPreferences';
import { guestCommunicationsService } from '../services/guestCommunications';
import { useNavigate } from 'react-router-dom';
import { QuickReservationDialog } from '../components/guest/QuickReservationDialog';


type Guest = GuestType;

export const GuestManagement: React.FC = () => {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const [guestReservations, setGuestReservations] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGuestSelect = (guest: Guest) => {
    setSelectedGuest(guest);
  };

  const addresses = useMemo(() => (selectedGuest as any)?.addresses ?? [], [selectedGuest]);
  const contacts = useMemo(() => (selectedGuest as any)?.emergency_contacts ?? [], [selectedGuest]);
  const preferences = useMemo(() => (selectedGuest as any)?.preferences ?? [], [selectedGuest]);
  const communications = useMemo(() => (selectedGuest as any)?.communications ?? [], [selectedGuest]);
  const reservations = guestReservations;

  useEffect(() => {
    const guestId = (selectedGuest as any)?.id;
    if (!guestId) {
      setGuestReservations([]);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        setReservationsLoading(true);
        const resp = await fetch(`/api/reservations/?guest=${guestId}&ordering=-start_time`);
        if (!resp.ok) throw new Error(`Failed to load reservations: ${resp.status}`);
        const data = await resp.json();
        const items = Array.isArray(data) ? data : (data?.results ?? []);
        if (!aborted) setGuestReservations(items);
      } catch (e) {
        console.error(e);
        if (!aborted) setGuestReservations([]);
      } finally {
        if (!aborted) setReservationsLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [selectedGuest]);

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
            <Box mt={2}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Overview" />
                <Tab label="Journey" />
                <Tab label="Reservations" />
                <Tab label="Preferences" />
                <Tab label="Communications" />
                <Tab label="Addresses & Contacts" />
                <Tab label="Feedback" />
              </Tabs>

              {activeTab === 0 && (
                <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
                  <GuestAnalytics
                    total_spent={(selectedGuest as any)?.total_spent ?? 0}
                    visit_count={(selectedGuest as any)?.visit_count ?? 0}
                    last_visit={(selectedGuest as any)?.last_visit ?? null}
                  />
                  <GuestRetentionTracker last_visit={(selectedGuest as any)?.last_visit ?? null} />
                  <LoyaltyProgramManager
                    loyalty_points={(selectedGuest as any)?.loyalty_points ?? 0}
                    membership_tier={(selectedGuest as any)?.membership_tier ?? undefined}
                    benefits={(selectedGuest as any)?.loyalty_benefits ?? undefined}
                  />
                  <GuestSegmentation groups={(selectedGuest as any)?.segments ?? []} />
                </Box>
              )}

              {activeTab === 1 && (
                <Box mt={2}>
                  <GuestJourneyTracker events={(selectedGuest as any)?.journey_events ?? []} />
                </Box>
              )}

              {activeTab === 2 && (
                <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Past Reservations</Typography>
                      {reservationsLoading && (
                        <Typography variant="body2" color="text.secondary">Loading…</Typography>
                      )}
                      <List dense>
                        {(() => {
                          const now = Date.now();
                          const past = reservations
                            .filter((r: any) => new Date(r?.end_time ?? r?.start_time ?? 0).getTime() < now)
                            .sort((a: any, b: any) => new Date(b?.end_time ?? b?.start_time ?? 0).getTime() - new Date(a?.end_time ?? a?.start_time ?? 0).getTime());
                          if (past.length === 0) return <Typography variant="body2" color="text.secondary">No past reservations.</Typography>;
                          return past.map((r: any, idx: number) => (
                            <React.Fragment key={r.id ?? idx}>
                              <ListItem disableGutters>
                                <ListItemText
                                  primary={r?.service_name ?? r?.reservation_services?.[0]?.service?.name ?? 'Reservation'}
                                  secondary={new Date(r?.start_time ?? r?.end_time ?? Date.now()).toLocaleString()}
                                />
                              </ListItem>
                              {idx < past.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                          ));
                        })()}
                      </List>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Upcoming Reservations</Typography>
                      {reservationsLoading && (
                        <Typography variant="body2" color="text.secondary">Loading…</Typography>
                      )}
                      <List dense>
                        {(() => {
                          const now = Date.now();
                          const upcoming = reservations
                            .filter((r: any) => new Date(r?.end_time ?? r?.start_time ?? 0).getTime() >= now)
                            .sort((a: any, b: any) => new Date(a?.start_time ?? a?.end_time ?? 0).getTime() - new Date(b?.start_time ?? b?.end_time ?? 0).getTime());
                          if (upcoming.length === 0) return <Typography variant="body2" color="text.secondary">No upcoming reservations.</Typography>;
                          return upcoming.map((r: any, idx: number) => (
                            <React.Fragment key={r.id ?? idx}>
                              <ListItem disableGutters>
                                <ListItemText
                                  primary={r?.service_name ?? r?.reservation_services?.[0]?.service?.name ?? 'Reservation'}
                                  secondary={new Date(r?.start_time ?? r?.end_time ?? Date.now()).toLocaleString()}
                                />
                              </ListItem>
                              {idx < upcoming.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                          ));
                        })()}
                      </List>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {activeTab === 3 && (
                <Box mt={2}>
                  <PreferenceManager
                    preferences={preferences}
                    onAdd={async () => {
                      if (!selectedGuest) return;
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
                </Box>
              )}

              {activeTab === 4 && (
                <Box mt={2}>
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
                </Box>
              )}

              {activeTab === 5 && (
                <Box mt={2} display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
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

              {activeTab === 6 && (
                <Box mt={2}>
                  <GuestFeedbackManager onSubmit={(text) => { try { console.log('Feedback submitted', { guestId: (selectedGuest as any)?.id, text }); } catch(e) { console.error(e); } }} />
                </Box>
              )}
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
