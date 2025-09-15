import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip, IconButton, Box, Button } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';

interface EmergencyContactItem {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

interface EmergencyContactListProps {
  contacts?: EmergencyContactItem[];
  onAdd?: () => void;
  onEdit?: (contact: EmergencyContactItem) => void;
  onDelete?: (contact: EmergencyContactItem) => void;
}

export const EmergencyContactList: React.FC<EmergencyContactListProps>
  = ({ contacts = [], onAdd, onEdit, onDelete }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Emergency Contacts</Typography>
          {onAdd && (
            <Button size="small" startIcon={<Add />} onClick={onAdd}>Add</Button>
          )}
        </Box>
        {contacts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No contacts.</Typography>
        ) : (
          <List dense>
            {contacts.map(c => (
              <ListItem key={c.id} disableGutters secondaryAction={
                <Box>
                  {onEdit && (
                    <IconButton edge="end" aria-label="edit" size="small" onClick={() => onEdit(c)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                  {onDelete && (
                    <IconButton edge="end" aria-label="delete" size="small" onClick={() => onDelete(c)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }>
                <ListItemText
                  primary={`${c.name} • ${c.relationship}`}
                  secondary={`${c.phone}${c.email ? ' • ' + c.email : ''}`}
                />
                {c.is_primary && <Chip size="small" color="success" label="Primary" />}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


