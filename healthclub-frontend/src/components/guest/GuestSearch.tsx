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
import { guestsService } from '../../services/guests';

import type { Guest } from '../../services/guests';

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
      const results = await guestsService.list({ search: term });
      setGuests(results);
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
                      <Box component="span" display="block">
                        <Box component="span" display="block">
                          <Typography component="span" variant="body2" color="text.secondary">
                            {guest.email} • {guest.phone}
                          </Typography>
                        </Box>
                        {guest.membership_tier && (
                          <Typography component="span" variant="caption" color="primary" display="block">
                            {typeof guest.membership_tier === 'string' ? guest.membership_tier : guest.membership_tier.display_name}
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
