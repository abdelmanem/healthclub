import React from 'react';
import { Box, Typography } from '@mui/material';
import { ConfigurationManager } from '../components/config/ConfigurationManager';

export const ConfigurationPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Configuration Management
      </Typography>
      <ConfigurationManager />
    </Box>
  );
};
