import React from 'react';
import { Button, IconButton } from '@mui/material';
import Logout from '@mui/icons-material/Logout';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';

interface LogoutButtonProps {
  variant?: 'button' | 'icon';
  size?: 'small' | 'medium' | 'large';
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ 
  variant = 'button', 
  size = 'medium' 
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  if (variant === 'icon') {
    return (
      <IconButton onClick={handleLogout} size={size} color="inherit">
        <Logout />
      </IconButton>
    );
  }

  return (
    <Button
      onClick={handleLogout}
      startIcon={<Logout />}
      variant="outlined"
      size={size}
    >
      Logout
    </Button>
  );
};