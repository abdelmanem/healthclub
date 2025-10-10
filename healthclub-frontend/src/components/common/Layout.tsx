import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge
} from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import AccountCircle from '@mui/icons-material/AccountCircle';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Search from '@mui/icons-material/Search';
import Notifications from '@mui/icons-material/Notifications';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { LogoutButton } from '../auth/LogoutButton';
import { notificationsService, NotificationItem } from '../../services/notifications';

interface LayoutProps {
  children: React.ReactNode;
}

interface SubNavConfig {
  items: Array<{ label: string; path: string }>;
}

const subNavConfigs: Record<string, SubNavConfig> = {
  'Appointments': {
    items: [
      { label: 'Calendar', path: '/reservations' },
      { label: 'Find Appointment', path: '/appointments/find' },
      { label: 'New Appointment', path: '/reservations/new' },
      { label: 'Manage Waitlist', path: '/reservations/waitlist' },
      { label: 'Class Schedule', path: '/reservations/classes' },
    ]
  },
  'Customers': {
    items: [
      { label: 'Customers List', path: '/guests' },
      { label: 'Guest Profile', path: '/guests/profile' },
    ]
  },
  'Products': {
    items: [
      { label: 'Service', path: '/services' }
    ]
  },
  'Reports': {
    items: [
      { label: 'Analytics', path: '/analytics' },
      { label: 'Dashboard', path: '/dashboard' }
    ]
  },
  'Schedules': {
    items: [
      { label: 'Employee Schedules', path: '/schedules/employees' }
    ]
  },
  'Housekeeping': {
    items: [
      { label: 'Housekeeping Management', path: '/housekeeping' }
    ]
  }
};

const mainNavItems = [
  'Appointments',
  'Customers',
  'Housekeeping',
  'Orders',
  'Schedules',
  'Marketing',
  'Products',
  'Reports'
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeSubNav, setActiveSubNav] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, hasPermission } = usePermissions();
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const clearNotifications = useCallback(async () => {
    try {
      await notificationsService.markAllRead();
      const list = await notificationsService.list();
      setNotifications(list);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue('');
    }
  };

  const toggleSubNav = (navKey: string) => {
    setActiveSubNav(prev => prev === navKey ? null : navKey);
  };

  // Hide sub-nav on route change
  useEffect(() => {
    setActiveSubNav(null);
  }, [location.pathname]);

  // Load notifications and poll every 60s
  useEffect(() => {
    let mounted = true;
    
    const loadNotifications = async () => {
      try {
        const list = await notificationsService.list();
        if (mounted) setNotifications(list);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };
    
    loadNotifications();
    const intervalId = setInterval(loadNotifications, 60000);
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const renderSubNav = () => {
    if (!activeSubNav || !subNavConfigs[activeSubNav]) return null;
    
    const config = subNavConfigs[activeSubNav];
    
    return (
      <Box 
        sx={{ 
          backgroundColor: '#ffffff', 
          px: 2, 
          py: 0.5, 
          borderBottom: '1px solid #E5E7EB' 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {config.items.map((item) => (
            <Button
              key={item.label}
              onClick={() => {
                navigate(item.path);
                setActiveSubNav(null);
              }}
              sx={{
                textTransform: 'none',
                color: '#374151',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: location.pathname === item.path ? '#E5E7EB' : 'transparent',
                '&:hover': { backgroundColor: '#F3F4F6' }
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Box>
    );
  };

  const unreadCount = notifications.length;
  const userInitial = user?.user.first_name?.[0] || user?.user.username?.[0] || 'U';

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
      <AppBar 
        position="fixed" 
        sx={{ 
          width: '100%', 
          backgroundColor: '#8B5CF6', 
          boxShadow: 'none' 
        }}
      >
        <Toolbar sx={{ minHeight: '40px !important', py: 0.5 }}>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 600, 
              fontSize: '1rem' 
            }}
          >
            Health Club Management System
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Scan ID or type name"
              variant="outlined"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
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
              onClick={() => navigate('/pro-tools')}
            >
              + Pro Tools
            </Button>
            
            <IconButton 
              sx={{ color: 'white', display: { xs: 'none', md: 'inline-flex' } }} 
              onClick={handleNotifOpen}
              aria-label="notifications"
            >
              <Badge badgeContent={unreadCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            
            <Menu
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={handleNotifClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{ sx: { minWidth: 280, maxHeight: 400 } }}
            >
              {notifications.length === 0 ? (
                <MenuItem disabled>No notifications</MenuItem>
              ) : (
                <>
                  {notifications.map((n) => (
                    <MenuItem 
                      key={n.id} 
                      onClick={handleNotifClose}
                      sx={{ whiteSpace: 'normal' }}
                    >
                      {n.text}
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem 
                    onClick={() => { 
                      clearNotifications(); 
                      handleNotifClose(); 
                    }} 
                    sx={{ color: 'error.main', fontWeight: 600 }}
                  >
                    Clear all
                  </MenuItem>
                </>
              )}
            </Menu>
            
            <IconButton
              size="large"
              aria-label="account menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              sx={{ color: 'white' }}
            >
              <Avatar sx={{ width: 32, height: 32, backgroundColor: '#A855F7' }}>
                {userInitial}
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
              <MenuItem onClick={() => { 
                handleMenuClose(); 
                navigate('/config'); 
              }}>
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
            {mainNavItems.map((label) => {
              const hasSubNav = !!subNavConfigs[label];
              return (
                <Button
                  key={label}
                  sx={{
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    backgroundColor: activeSubNav === label ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                  endIcon={hasSubNav ? <ChevronRight sx={{ fontSize: 16 }} /> : undefined}
                  onClick={() => hasSubNav && toggleSubNav(label)}
                >
                  {label}
                </Button>
              );
            })}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton 
              sx={{ color: 'white' }} 
              onClick={() => navigate('/config')}
              aria-label="settings"
            >
              <Settings />
            </IconButton>
          </Box>
        </Box>

        {renderSubNav()}
      </AppBar>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 2, 
          width: '100%', 
          mt: 12, 
          minHeight: 'calc(100vh - 96px)', 
          background: theme.palette.background.content 
        }}
      >
        {children}
      </Box>
    </Box>
  );
};