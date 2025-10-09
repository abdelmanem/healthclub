import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { LogoutButton } from '../auth/LogoutButton';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Health Club Management' }) => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <LogoutButton />
      </Toolbar>
    </AppBar>
  );
};
