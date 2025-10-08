import React from 'react';
import { Box, Typography } from '@mui/material';
import { ConfigurationManager } from '../components/config/ConfigurationManager';
import { ToastProvider } from '../components/common/ToastProvider';

export const ConfigurationPage: React.FC = () => {
  return (
    <ToastProvider>
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <ConfigurationManager />
      </Box>
    </ToastProvider>
  );
};
