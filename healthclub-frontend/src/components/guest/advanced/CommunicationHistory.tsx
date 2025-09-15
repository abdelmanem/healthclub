import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText } from '@mui/material';

interface CommunicationItem {
  id: number;
  communication_type: 'email' | 'sms' | 'phone' | 'in_person';
  subject: string;
  message: string;
  sent_at: string;
  sent_by_name?: string;
  is_successful?: boolean;
}

export const CommunicationHistory: React.FC<{ communications?: CommunicationItem[] }>
  = ({ communications = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Communication History</Typography>
        {communications.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No communications yet.</Typography>
        ) : (
          <List dense>
            {communications.map(c => (
              <ListItem key={c.id} disableGutters>
                <ListItemText
                  primary={`${c.communication_type.toUpperCase()} • ${c.subject}`}
                  secondary={`${new Date(c.sent_at).toLocaleString()} • ${c.sent_by_name ?? ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


