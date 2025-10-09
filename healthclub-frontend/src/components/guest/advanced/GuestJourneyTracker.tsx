import React from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';

interface JourneyEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
}

interface GuestJourneyTrackerProps {
  events?: JourneyEvent[];
}

export const GuestJourneyTracker: React.FC<GuestJourneyTrackerProps> = ({ events = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Guest Journey</Typography>
        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No journey data yet.</Typography>
        ) : (
          <Box>
            <List dense>
              {events.map(e => (
                <ListItem key={e.id} disableGutters>
                  <ListItemText
                    primary={e.title}
                    secondary={<span>{new Date(e.timestamp).toLocaleString()} {e.description ? `• ${e.description}` : ''}</span>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


