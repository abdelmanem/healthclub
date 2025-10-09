import React from 'react';
import { Card, CardContent, Typography, Chip, Box } from '@mui/material';

export const GuestSegmentation: React.FC<{ groups?: string[] }>
  = ({ groups = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Segments</Typography>
        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No segments.</Typography>
        ) : (
          <Box display="flex" gap={1} flexWrap="wrap">
            {groups.map((g) => <Chip key={g} label={g} />)}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


