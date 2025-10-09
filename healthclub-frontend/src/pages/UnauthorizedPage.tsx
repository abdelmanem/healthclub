import React from 'react';
import { Container, Typography, Box, Alert } from '@mui/material';
import { Security } from '@mui/icons-material';

export const UnauthorizedPage: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Security sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" paragraph>
          You don't have permission to access this page.
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          Please contact your administrator if you believe this is an error.
        </Alert>
      </Box>
    </Container>
  );
};
