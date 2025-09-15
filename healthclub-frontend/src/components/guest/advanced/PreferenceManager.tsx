import React from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';

interface PreferenceItem {
  id: number;
  service: number;
  service_name?: string;
  rating: number;
  notes?: string;
}

export const PreferenceManager: React.FC<{ preferences?: PreferenceItem[] }>
  = ({ preferences = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Preferences</Typography>
        {preferences.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No preferences recorded.</Typography>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={1}>
            {preferences.map(p => (
              <Chip key={p.id} label={`${p.service_name ?? p.service} • ${p.rating}/5`} />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


