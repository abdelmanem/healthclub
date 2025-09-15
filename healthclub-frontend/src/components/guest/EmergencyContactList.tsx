import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';

interface EmergencyContactItem {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

export const EmergencyContactList: React.FC<{ contacts?: EmergencyContactItem[] }>
  = ({ contacts = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Emergency Contacts</Typography>
        {contacts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No contacts.</Typography>
        ) : (
          <List dense>
            {contacts.map(c => (
              <ListItem key={c.id} disableGutters>
                <ListItemText
                  primary={`${c.name} • ${c.relationship}`}
                  secondary={`${c.phone}${c.email ? ' • ' + c.email : ''}`}
                />
                {c.is_primary && <Chip size="small" color="success" label="Primary" />}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


