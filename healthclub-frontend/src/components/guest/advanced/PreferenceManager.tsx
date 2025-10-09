import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Button, IconButton } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';

interface PreferenceItem {
  id: number;
  service: number;
  service_name?: string;
  rating: number;
  notes?: string;
}

interface PreferenceManagerProps {
  preferences?: PreferenceItem[];
  onAdd?: () => void;
  onRemove?: (preference: PreferenceItem) => void;
}

export const PreferenceManager: React.FC<PreferenceManagerProps>
  = ({ preferences = [], onAdd, onRemove }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Preferences</Typography>
          {onAdd && (
            <Button size="small" startIcon={<Add />} onClick={onAdd}>Add</Button>
          )}
        </Box>
        {preferences.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No preferences recorded.</Typography>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={1}>
            {preferences.map(p => (
              <Chip
                key={p.id}
                label={`${p.service_name ?? p.service} • ${p.rating}/5`}
                onDelete={onRemove ? () => onRemove(p) : undefined}
                deleteIcon={onRemove ? <Delete /> : undefined}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


