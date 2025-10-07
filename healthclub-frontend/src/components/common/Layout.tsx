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
import { Menu as MenuIcon, Settings, AccountCircle, ChevronLeft, ChevronRight, Search, Notifications } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { LogoutButton } from '../auth/LogoutButton';
import { notificationsService, NotificationItem } from '../../services/notifications';

const drawerWidth = 240;
const collapsedDrawerWidth = 64;

interface LayoutProps {
  children: React.ReactNode;
}

interface SubNavConfig {
  items: Array<{ label: string; path: string }>;
}

interface SideMenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  permission: string;
  model: string;
}

const menuItems: SideMenuItem[] = [
  
];

const subNavConfigs: Record<string, SubNavConfig> = {
  'Appointments': {
    items: [
      { label: 'Calendar', path: '/reservations' },
      { label: 'Find Appointment', path: '/reservations/find' },
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
      { label: 'service', path: '/services' }
    ]
  },
  'Reports': {
    items: [
      { label: 'Analytics', path: '/analytics' },
      { label: 'Dashboard', path: '/dashboard' }
    ]
  },
  'Housekeeping': {
    items: [
      { label: 'Housekeeping Management', path: '/housekeeping' }
    ]
  }
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeSubNav, setActiveSubNav] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  
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

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const clearNotifications = async () => {
    await notificationsService.markAllRead();
    const list = await notificationsService.list();
    setNotifications(list);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const toggleSubNav = (navKey: string) => {
    setActiveSubNav(activeSubNav === navKey ? null : navKey);
  };

  // Hide sub-nav on route change
  useEffect(() => {
    setActiveSubNav(null);
  }, [location.pathname]);

  // Load notifications and poll every 60s
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const list = await notificationsService.list();
      if (mounted) setNotifications(list);
    };
    load();
    const intervalId = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, []);

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

  const renderSubNav = () => {
    if (!activeSubNav || !subNavConfigs[activeSubNav]) return null;
    
    const config = subNavConfigs[activeSubNav];
    
    return (
      <Box sx={{ backgroundColor: '#ffffff', px: 2, py: 0.5, borderBottom: '1px solid #E5E7EB' }}>
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
            <IconButton sx={{ color: 'white', display: { xs: 'none', md: 'inline-flex' } }} onClick={handleNotifOpen}>
              <Badge badgeContent={notifications.length} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            <Menu
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={handleNotifClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{ sx: { minWidth: 280 } }}
            >
              {notifications.length === 0 ? (
                <MenuItem disabled>No notifications</MenuItem>
              ) : (
                <>
                  {notifications.map((n) => (
                    <MenuItem key={n.id} onClick={handleNotifClose}>
                      {n.text}
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={() => { clearNotifications(); handleNotifClose(); }} sx={{ color: 'error.main', fontWeight: 600 }}>
                    Clear all
                  </MenuItem>
                </>
              )}
            </Menu>
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
              <MenuItem onClick={() => { handleMenuClose(); navigate('/config'); }}>
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
            {['Appointments','Customers','Housekeeping','Orders','Schedules','Marketing','Products','Reports'].map((label) => {
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
                  onClick={() => hasSubNav ? toggleSubNav(label) : null}
                >
                  {label}
                </Button>
              );
            })}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton sx={{ color: 'white' }} onClick={() => navigate('/config')}>
              <Settings />
            </IconButton>
          </Box>
        </Box>

        {renderSubNav()}
      </AppBar>

      <Box component="nav" sx={{ width: { md: desktopCollapsed ? collapsedDrawerWidth : drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
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

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: desktopCollapsed ? collapsedDrawerWidth : drawerWidth,
              background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 30%, #3b82f6 70%, #60a5fa 100%)',
              color: '#ffffff',
              borderRight: '1px solid rgba(255, 255, 255, 0.2)',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
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
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              },
              '& .MuiListItemIcon-root': {
                color: '#ffffff',
              },
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 2, 
          width: { 
            xs: '100%', 
            md: `calc(100% - ${desktopCollapsed ? collapsedDrawerWidth : drawerWidth}px)` 
          }, 
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