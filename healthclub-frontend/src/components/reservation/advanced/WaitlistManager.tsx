import React from 'react';
import { Card, CardContent, Typography, FormControlLabel, Checkbox, TextField } from '@mui/material';

interface WaitlistManagerProps {
  enabled: boolean;
  onChange: (data: { enabled: boolean; maxWaitMinutes?: number }) => void;
  value?: { enabled: boolean; maxWaitMinutes?: number };
}

export const WaitlistManager: React.FC<WaitlistManagerProps> = ({ enabled, onChange, value }) => {
  const [maxWaitMinutes, setMaxWaitMinutes] = React.useState<number>(value?.maxWaitMinutes || 30);

  React.useEffect(() => {
    onChange({ enabled, maxWaitMinutes });
  }, [enabled, maxWaitMinutes, onChange]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Waitlist</Typography>
        <FormControlLabel
          control={<Checkbox checked={enabled} onChange={(e) => onChange({ enabled: e.target.checked, maxWaitMinutes })} />}
          label="Add to waitlist if time not available"
        />
        {enabled && (
          <TextField type="number" label="Max wait (minutes)" value={maxWaitMinutes} onChange={(e) => setMaxWaitMinutes(parseInt(e.target.value || '0', 10))} />
        )}
      </CardContent>
    </Card>
  );
};


