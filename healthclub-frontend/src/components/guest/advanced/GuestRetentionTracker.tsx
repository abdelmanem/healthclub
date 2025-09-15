import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

export const GuestRetentionTracker: React.FC<{ last_visit?: string | null }>
  = ({ last_visit }) => {
  const daysSince = last_visit ? Math.ceil((Date.now() - new Date(last_visit).getTime()) / (1000*60*60*24)) : null;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Retention</Typography>
        <Typography variant="body2" color="text.secondary">
          {daysSince == null ? 'No visits yet.' : `Days since last visit: ${daysSince}`}
        </Typography>
      </CardContent>
    </Card>
  );
};


