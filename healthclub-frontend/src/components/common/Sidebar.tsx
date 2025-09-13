import React from 'react';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { 
  Dashboard, 
  People, 
  Event, 
  Business, 
  Assessment, 
  Settings,
  Inventory,
  Email,
  Security
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';

const drawerWidth = 240;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canView } = usePermissions();

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/', permission: 'view', model: 'dashboard' },
    { text: 'Guests', icon: <People />, path: '/guests', permission: 'view', model: 'guests' },
    { text: 'Reservations', icon: <Event />, path: '/reservations', permission: 'view', model: 'reservations' },
    { text: 'Services', icon: <Business />, path: '/services', permission: 'view', model: 'services' },
    { text: 'Employees', icon: <People />, path: '/employees', permission: 'view', model: 'employees' },
    { text: 'Inventory', icon: <Inventory />, path: '/inventory', permission: 'view', model: 'inventory' },
    { text: 'Marketing', icon: <Email />, path: '/marketing', permission: 'view', model: 'marketing' },
    { text: 'Analytics', icon: <Assessment />, path: '/analytics', permission: 'view', model: 'analytics' },
    { text: 'Security', icon: <Security />, path: '/security', permission: 'view', model: 'security' },
    { text: 'Settings', icon: <Settings />, path: '/settings', permission: 'view', model: 'config' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ overflow: 'auto' }}>
        <Typography variant="h6" sx={{ p: 2, textAlign: 'center' }}>
          Navigation
        </Typography>
        <List>
          {menuItems.map((item) => {
            // Check if user has permission to view this section
            if (!canView(item.model)) {
              return null;
            }

            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => handleNavigation(item.path)}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};
