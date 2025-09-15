import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';

interface AddressItem {
  id: number;
  address_type: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

export const AddressList: React.FC<{ addresses?: AddressItem[] }> = ({ addresses = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Addresses</Typography>
        {addresses.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No addresses.</Typography>
        ) : (
          <List dense>
            {addresses.map(a => (
              <ListItem key={a.id} disableGutters>
                <ListItemText
                  primary={`${a.street_address}, ${a.city}, ${a.state} ${a.postal_code}`}
                  secondary={`${a.address_type.toUpperCase()} • ${a.country}`}
                />
                {a.is_primary && <Chip size="small" color="success" label="Primary" />}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


