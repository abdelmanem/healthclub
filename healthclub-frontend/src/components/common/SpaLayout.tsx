import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Avatar,
  Tabs,
  Tab,
  Paper,
  Grid,
  Chip,
  Badge,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Search,
  Notifications,
  Settings,
  CalendarToday,
  PersonAdd,
  Description,
  Group,
  VpnKey,
  GridView,
  Refresh,
  Add,
  Print,
  Folder,
  ChevronLeft,
  ChevronRight,
  Today
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface SpaLayoutProps {
  children: React.ReactNode;
  hideTopBars?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const SpaLayout: React.FC<SpaLayoutProps> = ({ children, hideTopBars }) => {
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const mainNavItems = [
    'Appointments',
    'Customers', 
    'Orders',
    'Schedules',
    'Marketing',
    'Products',
    'Reports'
  ];

  const subNavItems = [
    { label: 'Calendar', value: 0 },
    { label: 'Find Appointment', value: 1 },
    { label: 'New Appointment', value: 2 },
    { label: 'Manage Waitlist', value: 3 },
    { label: 'Class Schedule', value: 4 }
  ];

  const walkInIcons = [
    { icon: <PersonAdd />, label: 'Add Customer' },
    { icon: <Description />, label: 'Document' },
    { icon: <Group />, label: 'Group' },
    { icon: <VpnKey />, label: 'Key' }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f5f5f5' }}>
      {!hideTopBars && (
        <>
          <AppBar 
            position="static" 
            sx={{ 
              backgroundColor: '#8B5CF6',
              boxShadow: 'none',
              zIndex: 1200
            }}
          >
            <Toolbar sx={{ minHeight: '48px !important', py: 1 }}>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                Heales club management system
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  size="small"
                  placeholder="scan ID or type name"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'white',
                      borderRadius: 2,
                      '& fieldset': {
                        borderColor: 'transparent',
                      },
                      '&:hover fieldset': {
                        borderColor: 'transparent',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'transparent',
                      },
                    },
                    '& .MuiInputBase-input': {
                      py: 1,
                      px: 2,
                      fontSize: '0.875rem'
                    }
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
                    px: 2,
                    py: 1,
                    '&:hover': {
                      backgroundColor: '#f3f4f6',
                    }
                  }}
                >
                  + Pro Tools
                </Button>
                
                <Avatar sx={{ width: 32, height: 32, backgroundColor: '#A855F7' }}>
                  RD
                </Avatar>
              </Box>
            </Toolbar>
          </AppBar>

          <Box sx={{ backgroundColor: '#8B5CF6', px: 3, py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {mainNavItems.map((item) => (
                <Button
                  key={item}
                  sx={{
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }
                  }}
                  endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    if (item === 'Appointments') {
                      try { setTabValue(0); } catch {}
                      navigate('/spa-scheduling');
                    }
                  }}
                >
                  {item}
                </Button>
              ))}
              
              <Box sx={{ flexGrow: 1 }} />
              
              <IconButton sx={{ color: 'white' }}>
                <Badge badgeContent={3} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
              
              <IconButton sx={{ color: 'white' }}>
                <Settings />
              </IconButton>
            </Box>
          </Box>
        </>
      )}

      {/* Sub Navigation replaced by context menu (hidden) */}
      <Box sx={{ display: 'none' }} />

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <Box sx={{ 
          width: { xs: 0, md: 240 }, 
          backgroundColor: 'white', 
          borderRight: '1px solid #E5E7EB',
          display: { xs: 'none', md: 'block' }
        }}>
          {/* Calendar Widget */}
          <Box sx={{ p: 1.5, borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                September 2025
              </Typography>
              <Box>
                <IconButton size="small" sx={{ p: 0.25 }}>
                  <ChevronLeft />
                </IconButton>
                <IconButton size="small" sx={{ p: 0.25 }}>
                  <ChevronRight />
                </IconButton>
              </Box>
            </Box>
            
            {/* Calendar Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25, mb: 1.5 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Typography key={`day-${index}`} variant="caption" sx={{ textAlign: 'center', fontWeight: 600, py: 0.5, fontSize: '0.7rem' }}>
                  {day}
                </Typography>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((date) => (
                <Box
                  key={date}
                  sx={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    backgroundColor: date === 29 ? '#8B5CF6' : 'transparent',
                    color: date === 29 ? 'white' : 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: date === 29 ? '#7C3AED' : '#F3F4F6',
                    }
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: date === 29 ? 600 : 400, fontSize: '0.7rem' }}>
                    {date}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Walk-ins Section */}
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
              {walkInIcons.map((item, index) => (
                <IconButton
                  key={index}
                  size="small"
                  sx={{
                    backgroundColor: '#F3F4F6',
                    '&:hover': {
                      backgroundColor: '#E5E7EB',
                    }
                  }}
                  title={item.label}
                >
                  {item.icon}
                </IconButton>
              ))}
            </Box>
            
            <Box sx={{ display: 'flex', mb: 1.5 }}>
              <Button
                variant={tabValue === 0 ? 'contained' : 'text'}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  mr: 1,
                  py: 0.25,
                  px: 1
                }}
              >
                Walk-ins
              </Button>
              <Button
                variant="text"
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 0.25,
                  px: 1
                }}
              >
                Manage
              </Button>
            </Box>
            
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.7rem' }}>
              Click Walk-Ins above to add a customer to the waitlist.
            </Typography>
          </Box>
        </Box>

        {/* Main Content - Appointment Grid */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TabPanel value={tabValue} index={0}>
            {children}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <Typography>Find Appointment - Coming Soon</Typography>
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <Typography>New Appointment - Coming Soon</Typography>
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <Typography>Manage Waitlist - Coming Soon</Typography>
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            <Typography>Class Schedule - Coming Soon</Typography>
          </TabPanel>
        </Box>
      </Box>
    </Box>
  );
};
