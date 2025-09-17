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
    // Only propagate changes when actual values differ to avoid render loops
    const valueEnabled = value?.enabled ?? false;
    const valueMaxWait = value?.maxWaitMinutes ?? 30;
    if (enabled !== valueEnabled || maxWaitMinutes !== valueMaxWait) {
      onChange({ enabled, maxWaitMinutes });
    }
    // Intentionally exclude onChange from deps to avoid infinite loops when parent recreates callbacks
  }, [enabled, maxWaitMinutes, value]);

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


