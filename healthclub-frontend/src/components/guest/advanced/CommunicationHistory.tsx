import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import { Add } from '@mui/icons-material';

interface CommunicationItem {
  id: number;
  communication_type: 'email' | 'sms' | 'phone' | 'in_person';
  subject: string;
  message: string;
  sent_at: string;
  sent_by_name?: string;
  is_successful?: boolean;
}

interface CommunicationHistoryProps {
  communications?: CommunicationItem[];
  onAdd?: () => void;
}

export const CommunicationHistory: React.FC<CommunicationHistoryProps>
  = ({ communications = [], onAdd }) => {
  return (
    <Card>
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Typography variant="h6">Communication History</Typography>
          {onAdd && (
            <Button size="small" startIcon={<Add />} onClick={onAdd}>Add</Button>
          )}
        </div>
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


