import React from 'react';
import { Card, CardContent, Typography, FormControlLabel, Checkbox, TextField } from '@mui/material';

interface BookingRuleManagerProps {
  minAdvanceHours?: number;
  maxAdvanceDays?: number;
  enforceGapMinutes?: number;
  onChange: (data: { minAdvanceHours: number; maxAdvanceDays: number; enforceGapMinutes: number; enforceRules: boolean }) => void;
  value?: { minAdvanceHours: number; maxAdvanceDays: number; enforceGapMinutes: number; enforceRules: boolean };
}

export const BookingRuleManager: React.FC<BookingRuleManagerProps> = ({ onChange, value }) => {
  const [enforceRules, setEnforceRules] = React.useState<boolean>(value?.enforceRules ?? true);
  const [minAdvanceHours, setMinAdvanceHours] = React.useState<number>(value?.minAdvanceHours ?? 1);
  const [maxAdvanceDays, setMaxAdvanceDays] = React.useState<number>(value?.maxAdvanceDays ?? 60);
  const [enforceGapMinutes, setEnforceGapMinutes] = React.useState<number>(value?.enforceGapMinutes ?? 10);

  React.useEffect(() => {
    onChange({ minAdvanceHours, maxAdvanceDays, enforceGapMinutes, enforceRules });
  }, [minAdvanceHours, maxAdvanceDays, enforceGapMinutes, enforceRules, onChange]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Booking Rules</Typography>
        <FormControlLabel control={<Checkbox checked={enforceRules} onChange={(e) => setEnforceRules(e.target.checked)} />} label="Enforce booking rules" />
        {enforceRules && (
          <>
            <TextField type="number" label="Min advance (hours)" value={minAdvanceHours} onChange={(e) => setMinAdvanceHours(parseInt(e.target.value || '0', 10))} sx={{ mr: 2 }} />
            <TextField type="number" label="Max advance (days)" value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(parseInt(e.target.value || '0', 10))} sx={{ mr: 2 }} />
            <TextField type="number" label="Gap between bookings (min)" value={enforceGapMinutes} onChange={(e) => setEnforceGapMinutes(parseInt(e.target.value || '0', 10))} />
          </>
        )}
      </CardContent>
    </Card>
  );
};


