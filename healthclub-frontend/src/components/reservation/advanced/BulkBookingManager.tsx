import React from 'react';
import { Card, CardContent, Typography, TextField, Button, Box } from '@mui/material';

interface BulkBookingManagerProps {
  onGenerate: (count: number) => void;
}

export const BulkBookingManager: React.FC<BulkBookingManagerProps> = ({ onGenerate }) => {
  const [count, setCount] = React.useState<number>(5);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Bulk Booking</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <TextField type="number" label="Number of bookings" value={count} onChange={(e) => setCount(parseInt(e.target.value || '0', 10))} />
          <Button variant="outlined" onClick={() => onGenerate(count)}>Generate</Button>
        </Box>
      </CardContent>
    </Card>
  );
};


