import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export const GuestAnalytics: React.FC<{
  total_spent?: number | string;
  visit_count?: number;
  last_visit?: string | null;
}> = ({ total_spent = 0, visit_count = 0, last_visit }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Guest Analytics</Typography>
        <Box>
          <Typography variant="body2" color="text.secondary">Total Spent: {total_spent}</Typography>
          <Typography variant="body2" color="text.secondary">Visits: {visit_count}</Typography>
          <Typography variant="body2" color="text.secondary">Last Visit: {last_visit ? new Date(last_visit).toLocaleString() : '—'}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
};


