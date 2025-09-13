import React from 'react';
import { Container, Typography, Box, Card, CardContent, Grid2 as Grid } from '@mui/material';
import { 
  People, 
  Event, 
  Business, 
  Assessment,
  TrendingUp,
  Schedule
} from '@mui/icons-material';
import { usePermissions } from '../contexts/PermissionContext';

export const Dashboard: React.FC = () => {
  const { user } = usePermissions();

  const stats = [
    { title: 'Total Guests', value: '1,234', icon: <People />, color: '#1976d2' },
    { title: 'Today\'s Reservations', value: '45', icon: <Event />, color: '#388e3c' },
    { title: 'Active Services', value: '12', icon: <Business />, color: '#f57c00' },
    { title: 'Revenue Today', value: '$2,450', icon: <TrendingUp />, color: '#7b1fa2' },
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

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid xs={12} sm={6} md={3} key={index}>
            <Card>
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
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Phase 1 implementation complete! Authentication and permission system are now active.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
