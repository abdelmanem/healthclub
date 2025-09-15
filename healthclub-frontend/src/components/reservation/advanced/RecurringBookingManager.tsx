import React from 'react';
import { Card, CardContent, Typography, FormControlLabel, Checkbox, Box, TextField, MenuItem } from '@mui/material';

interface RecurringBookingManagerProps {
  enabled: boolean;
  onChange: (data: { enabled: boolean; frequency?: 'daily' | 'weekly' | 'monthly'; count?: number }) => void;
  value?: { enabled: boolean; frequency?: 'daily' | 'weekly' | 'monthly'; count?: number };
}

export const RecurringBookingManager: React.FC<RecurringBookingManagerProps> = ({ enabled, onChange, value }) => {
  const [freq, setFreq] = React.useState<'daily' | 'weekly' | 'monthly'>(value?.frequency || 'weekly');
  const [count, setCount] = React.useState<number>(value?.count || 4);

  React.useEffect(() => {
    onChange({ enabled, frequency: freq, count });
  }, [enabled, freq, count, onChange]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Recurring Options</Typography>
        <FormControlLabel
          control={<Checkbox checked={enabled} onChange={(e) => onChange({ enabled: e.target.checked, frequency: freq, count })} />}
          label="Repeat this reservation"
        />
        {enabled && (
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2} mt={1}>
            <TextField select label="Frequency" value={freq} onChange={(e) => setFreq(e.target.value as any)}>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </TextField>
            <TextField type="number" label="Occurrences" value={count} onChange={(e) => setCount(parseInt(e.target.value || '0', 10))} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


