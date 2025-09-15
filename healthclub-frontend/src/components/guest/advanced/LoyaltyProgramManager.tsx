import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';

export const LoyaltyProgramManager: React.FC<{
  loyalty_points?: number;
  membership_tier?: string;
  benefits?: { discount: number; priority_booking: boolean; free_services: number };
}> = ({ loyalty_points = 0, membership_tier, benefits }) => {
  const target = 1000; // example threshold to next tier
  const progress = Math.min(100, Math.round((loyalty_points / target) * 100));
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Loyalty</Typography>
        <Box mb={1}>
          <Typography variant="body2" color="text.secondary">Tier: {membership_tier ?? '—'}</Typography>
          <Typography variant="body2" color="text.secondary">Points: {loyalty_points}</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} />
        {benefits && (
          <Box mt={1}>
            <Typography variant="caption">Benefits: {benefits.discount}% off • Free services: {benefits.free_services}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


