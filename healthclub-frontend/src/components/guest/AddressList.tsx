import React from 'react';
import { Card, CardContent, Typography, List, ListItem, ListItemText, Chip, IconButton, Box, Button } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';

interface AddressItem {
  id: number;
  address_type: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

interface AddressListProps {
  addresses?: AddressItem[];
  onAdd?: () => void;
  onEdit?: (address: AddressItem) => void;
  onDelete?: (address: AddressItem) => void;
}

export const AddressList: React.FC<AddressListProps> = ({ addresses = [], onAdd, onEdit, onDelete }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Addresses</Typography>
          {onAdd && (
            <Button size="small" startIcon={<Add />} onClick={onAdd}>Add</Button>
          )}
        </Box>
        {addresses.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No addresses.</Typography>
        ) : (
          <List dense>
            {addresses.map(a => (
              <ListItem key={a.id} disableGutters secondaryAction={
                <Box>
                  {onEdit && (
                    <IconButton edge="end" aria-label="edit" size="small" onClick={() => onEdit(a)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                  {onDelete && (
                    <IconButton edge="end" aria-label="delete" size="small" onClick={() => onDelete(a)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }>
                <ListItemText
                  primary={`${a.street_address}, ${a.city}, ${a.state} ${a.postal_code}`}
                  secondary={`${a.address_type.toUpperCase()} • ${a.country}`}
                />
                {a.is_primary && <Chip size="small" color="success" label="Primary" />}
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


