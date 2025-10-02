import React, { useEffect, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
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
  Divider,
  Badge
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
  ChevronRight,
  Search,
  Notifications
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
  const [subNavActive, setSubNavActive] = useState<string>('Calendar');
  const [showAppointmentsSubNav, setShowAppointmentsSubNav] = useState<boolean>(false);
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

  // Hide Appointments sub-nav on any route change
  useEffect(() => {
    setShowAppointmentsSubNav(false);
  }, [location.pathname]);

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
      <AppBar position="fixed" sx={{ width: '100%', backgroundColor: '#8B5CF6', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: '40px !important', py: 0.5 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600, fontSize: '1rem' }}>
            Health Club Management System
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="scan ID or type name"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'transparent' },
                  '&.Mui-focused fieldset': { borderColor: 'transparent' },
                },
                '& .MuiInputBase-input': { py: 0.5, px: 1.5, fontSize: '0.85rem' }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#666', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              sx={{
                backgroundColor: 'white',
                color: '#8B5CF6',
                fontWeight: 600,
                px: 1.5,
                py: 0.5,
                '&:hover': { backgroundColor: '#f3f4f6' }
              }}
            >
              + Pro Tools
            </Button>
            <IconButton sx={{ color: 'white', display: { xs: 'none', md: 'inline-flex' } }}>
              <Badge badgeContent={3} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              sx={{ color: 'white' }}
            >
              <Avatar sx={{ width: 32, height: 32, backgroundColor: '#A855F7' }}>
                {user?.user.first_name?.[0] || user?.user.username?.[0] || 'U'}
              </Avatar>
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
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
        <Box sx={{ backgroundColor: '#8B5CF6', px: 2, py: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {['Appointments','Customers','Orders','Schedules','Marketing','Products','Reports'].map((label) => (
              <Button
                key={label}
                sx={{
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                }}
                endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                onClick={() => {
                  if (label === 'Appointments') {
                    setShowAppointmentsSubNav((v) => !v);
                    setSubNavActive('Calendar');
                    return;
                  }
                  setShowAppointmentsSubNav(false);
                }}
              >
                {label}
              </Button>
            ))}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton sx={{ color: 'white' }}>
              <Settings />
            </IconButton>
          </Box>
        </Box>

        {/* Sub navigation for Appointments */}
        {(() => {
          if (!showAppointmentsSubNav) return null;
          const items = ['Calendar','Find Appointment','New Appointment','Manage Waitlist','Class Schedule'];
          return (
            <Box sx={{ backgroundColor: '#ffffff', px: 2, py: 0.5, borderBottom: '1px solid #E5E7EB' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {items.map((label) => (
                  <Button
                    key={label}
                    onClick={() => {
                      setSubNavActive(label);
                      if (label === 'Calendar') navigate('/reservations');
                      if (label === 'New Appointment') navigate('/reservations/new');
                      setShowAppointmentsSubNav(false);
                    }}
                    sx={{
                      textTransform: 'none',
                      color: '#374151',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      backgroundColor: subNavActive === label ? '#E5E7EB' : 'transparent',
                      '&:hover': { backgroundColor: '#F3F4F6' }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>
            </Box>
          );
        })()}
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

      <Box component="main" sx={{ flexGrow: 1, p: 2, width: '100%', mt: 12, minHeight: 'calc(100vh - 96px)', background: theme.palette.background.content }}>
        {children}
      </Box>
    </Box>
  );
};