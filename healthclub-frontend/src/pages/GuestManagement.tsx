import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Divider
} from '@mui/material';
import { Add, Person } from '@mui/icons-material';
import { GuestSearch } from '../components/guest/GuestSearch';
import { PermissionGate } from '../components/common/PermissionGate';

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

export const GuestManagement: React.FC = () => {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

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
            onClick={() => {
              // TODO: Open create guest dialog
              console.log('Create new guest');
            }}
          >
            Add Guest
          </Button>
        </PermissionGate>
      </Box>

      <Grid container spacing={3}>
        <Grid size={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search Guests
              </Typography>
              <GuestSearch onGuestSelect={handleGuestSelect} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Guest Details
              </Typography>
              
              {selectedGuest ? (
                <Box>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">
                      {selectedGuest.first_name} {selectedGuest.last_name}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Email: {selectedGuest.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Phone: {selectedGuest.phone}
                    </Typography>
                    {selectedGuest.membership_tier && (
                      <Box mt={1}>
                        <Chip
                          label={selectedGuest.membership_tier.display_name}
                          color="primary"
                          size="small"
                        />
                      </Box>
                    )}
                  </Box>

                  <Box display="flex" gap={1}>
                    <PermissionGate permission="change" model="guests">
                      <Button variant="outlined" size="small">
                        Edit Guest
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="view" model="reservations">
                      <Button variant="outlined" size="small">
                        View Reservations
                      </Button>
                    </PermissionGate>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select a guest from the search results to view details
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
