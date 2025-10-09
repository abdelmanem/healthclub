import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

interface ReservationAnalyticsProps {
  kpis?: { title: string; value: string | number }[];
}

export const ReservationAnalytics: React.FC<ReservationAnalyticsProps> = ({ kpis = [] }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Reservation Analytics</Typography>
        {kpis.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No analytics available.</Typography>
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: 16 }}>
            {kpis.map((k, idx) => (
              <li key={idx}><Typography variant="body2">{k.title}: {k.value}</Typography></li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};


