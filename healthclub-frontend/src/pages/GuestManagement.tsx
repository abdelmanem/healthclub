import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Person,
  CalendarToday,
  Favorite,
  Message,
  LocationOn,
  Phone,
  TrendingUp,
  EmojiEvents,
  Group,
  Email,
  Add,
  Edit,
  Visibility,
  FlashOn
} from '@mui/icons-material';
import { PermissionGate } from '../components/common/PermissionGate';
import { CreateGuestDialog } from '../components/guest/CreateGuestDialog';
import { EditGuestDialog } from '../components/guest/EditGuestDialog';
import { CommunicationHistory } from '../components/guest/advanced/CommunicationHistory';
import { AddressList } from '../components/guest/AddressList';
import { EmergencyContactList } from '../components/guest/EmergencyContactList';
import { CreateAddressDialog } from '../components/guest/CreateAddressDialog';
import { CreateEmergencyContactDialog } from '../components/guest/CreateEmergencyContactDialog';
import { GuestJourneyTracker } from '../components/guest/advanced/GuestJourneyTracker';
import { guestsService, Guest as GuestType, MembershipTierObject } from '../services/guests';
import { guestPreferencesService } from '../services/guestPreferences';
import { guestCommunicationsService } from '../services/guestCommunications';
import { useNavigate } from 'react-router-dom';
import { reservationsService } from '../services/reservations';
import { QuickReservationDialog } from '../components/guest/QuickReservationDialog';


type Guest = GuestType & {
  avatar?: string;
  last_visit?: string;
};

export const GuestManagement: React.FC = () => {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const [guestReservations, setGuestReservations] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const navigate = useNavigate();


  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'journey', label: 'Journey', icon: CalendarToday },
    { id: 'reservations', label: 'Reservations', icon: CalendarToday },
    { id: 'preferences', label: 'Preferences', icon: Favorite },
    { id: 'communications', label: 'Communications', icon: Message },
    { id: 'addresses', label: 'Contact Info', icon: LocationOn },
  ];

  const tierColors = {
    'platinum': 'from-slate-400 to-slate-600',
    'gold': 'from-yellow-400 to-yellow-600',
    'silver': 'from-gray-300 to-gray-500',
    'bronze': 'from-orange-400 to-orange-600',
    'vip': 'from-purple-400 to-purple-600'
  };

  const getTierDisplayName = (tier: string | MembershipTierObject | undefined | null) => {
    if (!tier) return 'Member';
    if (typeof tier === 'string') {
      return tier.charAt(0).toUpperCase() + tier.slice(1);
    }
    return tier.display_name || tier.name.charAt(0).toUpperCase() + tier.name.slice(1);
  };

  const getTierKey = (tier: string | MembershipTierObject | undefined | null) => {
    if (!tier) return null;
    if (typeof tier === 'string') {
      return tier;
    }
    return tier.name;
  };

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
        const items = await reservationsService.list({ guest: guestId });
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

  // Load initial guests list (keeps search as-is, shows full list below)
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setGuestsLoading(true);
        const list = await guestsService.list();
        if (!aborted) setGuests(list as any);
      } catch (e) {
        console.error(e);
        if (!aborted) setGuests([]);
      } finally {
        if (!aborted) setGuestsLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Guest Management
            </h1>
            <p className="text-slate-600 mt-1">Manage guest profiles, preferences, and experiences</p>
          </div>
        <PermissionGate permission="add" model="guests">
            <button 
            onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105"
          >
            <Add sx={{ fontSize: 20 }} />
            Add Guest
            </button>
        </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Guest List */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Search Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100">
            <div className="relative">
              <Search sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 20 }} />
              <input
                type="text"
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Guest List Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">All Guests</h2>
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {guests.length}
              </span>
            </div>
            <div className="space-y-2">
                {guestsLoading && (
                <div className="text-center py-4 text-slate-500">Loading…</div>
                )}
                {!guestsLoading && guests.length === 0 && (
                <div className="text-center py-4 text-slate-500">No guests found.</div>
              )}
              {!guestsLoading && guests.map((guest: any, idx: number) => (
                <div
                  key={guest.id ?? idx}
                  onClick={() => handleGuestSelect(guest)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                    selectedGuest?.id === guest.id
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 shadow-md'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tierColors[getTierKey(guest.membership_tier) as keyof typeof tierColors] || 'from-gray-300 to-gray-500'} flex items-center justify-center text-white font-bold shadow-lg`}>
                      {guest.avatar || `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 truncate">
                          {`${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || 'Guest'}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${tierColors[getTierKey(guest.membership_tier) as keyof typeof tierColors] || 'from-gray-300 to-gray-500'} text-white`}>
                          {getTierDisplayName(guest.membership_tier)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate">{guest.email || guest.phone || undefined}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content - Guest Details */}
        <div className="col-span-12 lg:col-span-8">
              {selectedGuest ? (
            <div className="space-y-6">
              {/* Guest Profile Header */}
              <div className="bg-gradient-to-br from-white to-indigo-50/30 rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${tierColors[getTierKey(selectedGuest.membership_tier) as keyof typeof tierColors] || 'from-gray-300 to-gray-500'} flex items-center justify-center text-white text-2xl font-bold shadow-xl`}>
                      {(selectedGuest as any).avatar || `${selectedGuest.first_name?.[0] || ''}${selectedGuest.last_name?.[0] || ''}`}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800 mb-1">
                        {`${selectedGuest.first_name ?? ''} ${selectedGuest.last_name ?? ''}`.trim() || 'Guest'}
                      </h2>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${tierColors[getTierKey(selectedGuest.membership_tier) as keyof typeof tierColors] || 'from-gray-300 to-gray-500'} text-white text-sm font-medium`}>
                          {getTierDisplayName(selectedGuest.membership_tier)}
                        </span>
                        <span className="text-slate-600 flex items-center gap-1">
                          <EmojiEvents sx={{ fontSize: 16, color: '#6366f1' }} />
                          {selectedGuest.loyalty_points || 0} points
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditOpen(true)}
                      className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:scale-105"
                    >
                      <Edit sx={{ fontSize: 18, color: '#64748b' }} />
                    </button>
                    <button 
                      onClick={() => setIsQuickResOpen(true)}
                      className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all hover:scale-105"
                    >
                      <FlashOn sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                </div>

                {/* Contact Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Email sx={{ fontSize: 20, color: '#6366f1' }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="text-sm font-medium text-slate-800">{selectedGuest.email || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Phone sx={{ fontSize: 20, color: '#9333ea' }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="text-sm font-medium text-slate-800">{selectedGuest.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CalendarToday sx={{ fontSize: 20, color: '#16a34a' }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Last Visit</p>
                      <p className="text-sm font-medium text-slate-800">
                        {(selectedGuest as any).last_visit ? new Date((selectedGuest as any).last_visit).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap ${
                          activeTab === tab.id
                            ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
                        }`}
                      >
                        <Icon sx={{ fontSize: 18 }} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content */}
                <div className="p-8">
                  {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Stats Cards */}
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <TrendingUp sx={{ fontSize: 24 }} />
                          <span className="text-indigo-200 text-sm">Lifetime</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">${(selectedGuest as any)?.total_spent || 0}</h3>
                        <p className="text-indigo-200">Total Spent</p>
                      </div>

                      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <CalendarToday sx={{ fontSize: 24 }} />
                          <span className="text-green-200 text-sm">All Time</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{(selectedGuest as any)?.visit_count || 0}</h3>
                        <p className="text-green-200">Total Visits</p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <Favorite sx={{ fontSize: 24 }} />
                          <span className="text-orange-200 text-sm">Status</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">High</h3>
                        <p className="text-orange-200">Satisfaction</p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <Group sx={{ fontSize: 24 }} />
                          <span className="text-blue-200 text-sm">Segment</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-1">VIP</h3>
                        <p className="text-blue-200">Customer Type</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'journey' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Guest Journey</h3>
                  <GuestJourneyTracker events={(selectedGuest as any)?.journey_events ?? []} />
                    </div>
                  )}

                  {activeTab === 'reservations' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Upcoming Reservations</h3>
                        <button 
                          onClick={() => navigate(`/reservations?guest=${selectedGuest?.id}`)}
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          View All
                        </button>
                      </div>
                      {reservationsLoading && (
                        <div className="text-center py-4 text-slate-500">Loading…</div>
                      )}
                      {!reservationsLoading && reservations.length === 0 && (
                        <div className="text-center py-4 text-slate-500">No reservations found.</div>
                      )}
                      {!reservationsLoading && reservations.slice(0, 3).map((r: any, idx: number) => (
                        <div key={r.id ?? idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-800">
                                {r?.service_name ?? r?.reservation_services?.[0]?.service?.name ?? 'Reservation'}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {new Date(r?.start_time ?? r?.end_time ?? Date.now()).toLocaleString()}
                              </p>
                            </div>
                            <button className="text-indigo-600 hover:text-indigo-700">
                              <Visibility sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'preferences' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Guest Preferences</h3>
                        <button 
                          onClick={async () => {
                      if (!selectedGuest) return;
                      try {
                        const created = await guestPreferencesService.create(selectedGuest.id, { service: (preferences[0]?.service ?? 1), rating: 5 });
                        updateSelectedGuest((prev) => ({ ...prev, preferences: [...preferences, created] }));
                      } catch (e) { console.error(e); }
                    }}
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          <Add sx={{ fontSize: 16 }} />
                          Add Preference
                        </button>
                      </div>
                      {preferences.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No preferences set</div>
                      ) : (
                        preferences.map((pref: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-slate-700">{pref.service_name || `Preference ${i + 1}`}</span>
                            <Favorite sx={{ fontSize: 18, color: '#ef4444' }} />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'communications' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Communication History</h3>
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
                    </div>
                  )}

                  {activeTab === 'addresses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Addresses</h3>
                  <AddressList
                    addresses={addresses}
                    onAdd={handleAddAddress}
                    onEdit={handleEditAddress}
                    onDelete={handleDeleteAddress}
                  />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Emergency Contacts</h3>
                  <EmergencyContactList
                    contacts={contacts}
                    onAdd={handleAddContact}
                    onEdit={handleEditContact}
                    onDelete={handleDeleteContact}
                  />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-12 border border-slate-100 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Person sx={{ fontSize: 32, color: '#94a3b8' }} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No Guest Selected</h3>
              <p className="text-slate-600">Select a guest from the list to view their details</p>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};
