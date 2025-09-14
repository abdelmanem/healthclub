import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePermissions();

  const quickActions = [
    {
      title: 'Guest Management',
      description: 'Search and manage guest information',
      action: () => navigate('/guests'),
      color: '#2563eb'
    },
    {
      title: 'Reservations',
      description: 'Create and manage reservations',
      action: () => navigate('/reservations'),
      color: '#10b981'
    },
    {
      title: 'Services',
      description: 'View and manage services',
      action: () => navigate('/services'),
      color: '#f59e0b'
    },
    {
      title: 'Dashboard',
      description: 'View analytics and reports',
      action: () => navigate('/dashboard'),
      color: '#8b5cf6'
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Header */}
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Welcome to HealthClub Management System
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Hello, {user?.user?.first_name || user?.user?.username || 'User'}!
        </Typography>
        <Typography variant="body1" color="text.secondary" maxWidth="600px" mx="auto">
          Manage your health club operations efficiently with our comprehensive management system.
          Access guest information, reservations, services, and more from one centralized platform.
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box mb={6}>
        <Typography variant="h4" component="h2" gutterBottom textAlign="center" mb={4}>
          Quick Actions
        </Typography>
        <Grid container spacing={3}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h3" gutterBottom color={action.color}>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={action.action}
                    sx={{ color: action.color }}
                  >
                    Go to {action.title}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* System Status */}
      <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="primary">
          System Status
        </Typography>
        <Typography variant="body1" color="text.secondary">
          All systems operational • Last updated: {new Date().toLocaleString()}
        </Typography>
      </Paper>
    </Container>
  );
};
