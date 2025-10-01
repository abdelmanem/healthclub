import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Event,
  Business,
  Assessment,
  Settings,
  AccountCircle,
  CleaningServices,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { LogoutButton } from '../auth/LogoutButton';

const drawerWidth = 240;
const collapsedDrawerWidth = 64;

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', permission: 'view', model: 'dashboard' },
  { text: 'Guests', icon: <People />, path: '/guests', permission: 'view', model: 'guests' },
  { text: 'Reservations', icon: <Event />, path: '/reservations', permission: 'view', model: 'reservations' },
  { text: 'Spa Scheduling', icon: <Event />, path: '/spa-scheduling', permission: 'view', model: 'reservations' },
  { text: 'Housekeeping Management', icon: <CleaningServices />, path: '/housekeeping', permission: 'view', model: 'reservations' },
  { text: 'Services', icon: <Business />, path: '/services', permission: 'view', model: 'services' },
  { text: 'Analytics', icon: <Assessment />, path: '/analytics', permission: 'view', model: 'analytics' },
  { text: 'Configuration', icon: <Settings />, path: '/config', permission: 'view', model: 'config' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, hasPermission } = usePermissions();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopDrawerToggle = () => {
    setDesktopCollapsed(!desktopCollapsed);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
        {!desktopCollapsed && (
          <Typography variant="h6" noWrap component="div">
            Health Club
          </Typography>
        )}
        {!isMobile && (
          <IconButton onClick={handleDesktopDrawerToggle} size="small">
            {desktopCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => {
          if (!hasPermission(item.permission, item.model)) {
            return null;
          }
          
          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  minHeight: 48,
                  justifyContent: desktopCollapsed && !isMobile ? 'center' : 'initial',
                  px: desktopCollapsed && !isMobile ? 1.5 : 2,
                }}
                title={desktopCollapsed && !isMobile ? item.text : ''}
              >
                <ListItemIcon
                  sx={{
                    minWidth: desktopCollapsed && !isMobile ? 'auto' : 56,
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {(!desktopCollapsed || isMobile) && (
                  <ListItemText 
                    primary={item.text} 
                    sx={{ 
                      opacity: desktopCollapsed && !isMobile ? 0 : 1,
                      transition: 'opacity 0.2s',
                    }} 
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
      <AppBar position="fixed" sx={{ width: '100%' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Health Club Management System
          </Typography>

          {/* Desktop top navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            {menuItems.map((item) => (
              hasPermission(item.permission, item.model) ? (
                <ListItemButton
                  key={item.text}
                  onClick={() => handleNavigation(item.path)}
                  selected={location.pathname === item.path}
                  sx={{ borderRadius: 1, color: 'inherit' }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ) : null
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Welcome, {user?.user.first_name || user?.user.username}
            </Typography>
            
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.user.first_name?.[0] || user?.user.username?.[0] || 'U'}
              </Avatar>
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
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleMenuClose}>
                <AccountCircle sx={{ mr: 1 }} />
                Profile
              </MenuItem>
              <MenuItem onClick={handleMenuClose}>
                <Settings sx={{ mr: 1 }} />
                Settings
              </MenuItem>
              <Divider />
              <MenuItem>
                <LogoutButton variant="button" size="small" />
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: 0 }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 30%, #3b82f6 70%, #60a5fa 100%)',
              color: '#ffffff',
              borderRight: '1px solid rgba(255, 255, 255, 0.2)',
              '& .MuiTypography-root': {
                color: '#ffffff',
                fontWeight: 500,
              },
              '& .MuiIconButton-root': {
                color: '#ffffff',
              },
              '& .MuiListItem-root': {
                color: '#ffffff',
              },
              '& .MuiListItemButton-root': {
                color: '#ffffff',
              },
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: '100%', mt: 8, minHeight: 'calc(100vh - 64px)', background: theme.palette.background.content }}>
        {children}
      </Box>
    </Box>
  );
};