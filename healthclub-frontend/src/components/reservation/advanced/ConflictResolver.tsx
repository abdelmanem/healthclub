import React from 'react';
import { Card, CardContent, Typography, Alert, Button, Box } from '@mui/material';

interface Conflict {
  id: string | number;
  description: string;
}

interface ConflictResolverProps {
  conflicts: Conflict[];
  onResolve: (action: 'move' | 'override' | 'cancel') => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ conflicts, onResolve }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Conflicts Detected</Typography>
        {conflicts.map(c => (
          <Alert key={c.id} severity="warning" sx={{ mb: 1 }}>{c.description}</Alert>
        ))}
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => onResolve('move')}>Suggest Another Time</Button>
          <Button variant="outlined" color="error" onClick={() => onResolve('cancel')}>Cancel Request</Button>
          <Button variant="contained" color="warning" onClick={() => onResolve('override')}>Override (if allowed)</Button>
        </Box>
      </CardContent>
    </Card>
  );
};


