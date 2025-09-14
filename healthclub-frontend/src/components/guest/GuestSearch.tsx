import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { api } from '../../services/api';

interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  membership_tier?: {
    name: string;
    display_name: string;
  };
}

interface GuestSearchProps {
  onGuestSelect: (guest: Guest) => void;
}

export const GuestSearch: React.FC<GuestSearchProps> = ({ onGuestSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchGuests(searchTerm);
      } else {
        setGuests([]);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const searchGuests = async (term: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/guests/search/?q=${encodeURIComponent(term)}`);
      setGuests(response.data);
    } catch (err: any) {
      setError('Failed to search guests. Please try again.');
      console.error('Guest search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSelect = (guest: Guest) => {
    onGuestSelect(guest);
    setSearchTerm('');
    setGuests([]);
  };

  return (
    <Box>
      <TextField
        fullWidth
        label="Search Guests"
        placeholder="Enter name, email, or phone number..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
        }}
        sx={{ mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      )}

      {guests.length > 0 && (
        <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {guests.map((guest) => (
              <ListItem key={guest.id} disablePadding>
                <ListItemButton onClick={() => handleGuestSelect(guest)}>
                  <ListItemText
                    primary={`${guest.first_name} ${guest.last_name}`}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {guest.email} • {guest.phone}
                        </Typography>
                        {guest.membership_tier && (
                          <Typography variant="caption" color="primary">
                            {guest.membership_tier.display_name}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {searchTerm.length >= 2 && guests.length === 0 && !isLoading && (
        <Typography variant="body2" color="text.secondary" textAlign="center" p={2}>
          No guests found matching "{searchTerm}"
        </Typography>
      )}
    </Box>
  );
};
