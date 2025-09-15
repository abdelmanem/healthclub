import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { 
  People, 
  Event, 
  Business, 
  Assessment,
  TrendingUp,
  Schedule
} from '@mui/icons-material';
import { usePermissions } from '../contexts/PermissionContext';
import { dashboardService, DashboardStats } from '../services/dashboard';

export const Dashboard: React.FC = () => {
  const { user } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getStatistics();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const formatStats = (data: DashboardStats) => [
    { title: 'Total Guests', value: data.total_guests.toLocaleString(), icon: <People />, color: '#1976d2' },
    { title: 'Today\'s Reservations', value: data.todays_reservations.toString(), icon: <Event />, color: '#388e3c' },
    { title: 'Active Services', value: data.active_services.toString(), icon: <Business />, color: '#f57c00' },
    { title: 'Revenue Today', value: `$${data.todays_revenue.toFixed(2)}`, icon: <TrendingUp />, color: '#7b1fa2' },
    { title: 'Active Employees', value: data.active_employees.toString(), icon: <Assessment />, color: '#9c27b0' },
    { title: 'Recent Reservations', value: data.recent_reservations.toString(), icon: <Schedule />, color: '#ff9800' },
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.user.first_name}!
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Here's what's happening at your health club today.
        </Typography>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {stats && (
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 3 
          }}
        >
          {formatStats(stats).map((stat, index) => (
            <Card key={index}>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Box
                    sx={{
                      backgroundColor: stat.color,
                      borderRadius: '50%',
                      p: 1,
                      mr: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {React.cloneElement(stat.icon, { sx: { color: 'white' } })}
                  </Box>
                  <Box>
                    <Typography variant="h4" component="div">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {stats && (
        <Box sx={{ mt: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Here are some quick actions you can take based on current data:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {stats.pending_reservations > 0 && (
                  <Typography variant="body2" color="warning.main">
                    • {stats.pending_reservations} reservations need attention
                  </Typography>
                )}
                {stats.todays_reservations > 0 && (
                  <Typography variant="body2" color="success.main">
                    • {stats.todays_reservations} reservations scheduled for today
                  </Typography>
                )}
                {stats.todays_revenue > 0 && (
                  <Typography variant="body2" color="primary.main">
                    • ${stats.todays_revenue.toFixed(2)} revenue generated today
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};
