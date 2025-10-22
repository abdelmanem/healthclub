import React, { useState } from 'react';
import { Box, Card, CardContent, Tab, Tabs } from '@mui/material';
import { DepositManagement } from './DepositManagement';
import { DepositHistory } from './DepositHistory';

interface DepositsTabProps {
  invoiceId: number;
  guestName: string;
  onUpdated?: () => void;
}

export const DepositsTab: React.FC<DepositsTabProps> = ({ invoiceId, guestName, onUpdated }) => {
  const [active, setActive] = useState<'apply' | 'history'>('apply');

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={active} onChange={(_, v) => setActive(v)}>
            <Tab value="apply" label="Apply Deposit" />
            <Tab value="history" label="Deposit History" />
          </Tabs>
        </Box>

        {active === 'apply' && (
          <Box>
            <DepositManagement
              invoiceId={invoiceId}
              guestName={guestName}
              onDepositApplied={() => onUpdated?.()}
            />
          </Box>
        )}

        {active === 'history' && (
          <Box>
            <DepositHistory
              invoiceId={invoiceId}
              guestName={guestName}
              onDepositUpdated={() => onUpdated?.()}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};


