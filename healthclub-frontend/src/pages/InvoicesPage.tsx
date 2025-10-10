/**
 * Complete example of invoice workflow integration
 * 
 * This shows how all components work together
 */

import React, { useState } from 'react';
import { Box, Container, Tabs, Tab, Paper } from '@mui/material';
import { InvoiceDashboard } from '../components/pos/InvoiceDashboard';
import { InvoiceList } from '../components/pos/InvoiceList';
import { PageWrapper } from '../components/common/PageWrapper';

export const InvoicesPage: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <PageWrapper title="Invoices & Payments">
      <Container maxWidth="xl">
        <Paper sx={{ p: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab label="Dashboard" />
            <Tab label="All Invoices" />
            <Tab label="Pending" />
            <Tab label="Overdue" />
          </Tabs>

          {tab === 0 && <InvoiceDashboard />}
          {tab === 1 && <InvoiceList />}
          {tab === 2 && <InvoiceList status="pending" />}
          {tab === 3 && <InvoiceList status="overdue" />}
        </Paper>
      </Container>
    </PageWrapper>
  );
};
