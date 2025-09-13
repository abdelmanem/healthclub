import React from 'react';
import { Button, IconButton, Menu, MenuItem, Typography, Box } from '@mui/material';
import { AccountCircle, Logout } from '@mui/icons-material';
import { usePermissions } from '../../contexts/PermissionContext';

export const LogoutButton: React.FC = () => {
  const { user, logout } = usePermissions();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  if (!user) {
    return null;
  }

  return (
    <Box display="flex" alignItems="center">
      <Typography variant="body2" sx={{ mr: 1 }}>
        {user.user.first_name} {user.user.last_name}
      </Typography>
      <IconButton
        size="large"
                aria-label="account of current user"
        aria-controls="menu-appbar"
        aria-haspopup="true"
        onClick={handleMenu}
        color="inherit"
      >
        <AccountCircle />
      </IconButton>
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};
