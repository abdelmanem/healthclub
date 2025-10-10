/**
 * ReservationWorkflowDemo Page
 * 
 * Demo page showing the complete reservation workflow
 */

import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { PageWrapper } from '../components/common/PageWrapper';
import { ReservationStatusDemo } from '../components/reservation/ReservationStatusDemo';

export const ReservationWorkflowDemo: React.FC = () => {
  return (
    <PageWrapper title="Reservation Workflow Demo">
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Reservation Workflow Demo
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            This demo shows the complete reservation lifecycle from booking to check-out.
            Use the "Next Status" button to progress through the workflow and see the available actions at each stage.
          </Typography>
        </Box>

        <ReservationStatusDemo />
      </Container>
    </PageWrapper>
  );
};
