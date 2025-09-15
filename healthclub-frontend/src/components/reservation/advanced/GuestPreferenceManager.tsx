import React from 'react';
import { Card, CardContent, Typography, Chip, Box } from '@mui/material';

interface Preference { id: number; name: string; rating?: number; }

interface GuestPreferenceManagerProps {
  preferences?: Preference[];
}

export const GuestPreferenceManager: React.FC<GuestPreferenceManagerProps> = ({ preferences = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Guest Preferences</Typography>
        {preferences.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No preferences found.</Typography>
        ) : (
          <Box display="flex" gap={1} flexWrap="wrap">
            {preferences.map(p => (
              <Chip key={p.id} label={`${p.name}${p.rating ? ` • ${p.rating}/5` : ''}`} />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


