import React from 'react';
import { Card, CardContent, Typography, TextField, Button, Box, MenuItem } from '@mui/material';

interface TemplateOption { id: number; name: string; }

interface ReservationTemplateManagerProps {
  templates?: TemplateOption[];
  onApply: (templateId: number) => void;
}

export const ReservationTemplateManager: React.FC<ReservationTemplateManagerProps> = ({ templates = [], onApply }) => {
  const [selected, setSelected] = React.useState<number | ''>('' as any);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Booking Templates</Typography>
        <Box display="flex" gap={2}>
          <TextField select label="Template" value={selected} onChange={(e) => setSelected(e.target.value as any)} sx={{ minWidth: 220 }}>
            {templates.map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" disabled={!selected} onClick={() => onApply(Number(selected))}>Apply</Button>
        </Box>
      </CardContent>
    </Card>
  );
};


