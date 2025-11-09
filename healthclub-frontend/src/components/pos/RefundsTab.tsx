import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, CircularProgress, List, ListItem, ListItemText, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { invoicesService, RefundHistoryResponse } from '../../services/invoices';
import { useCurrencyFormatter } from '../../utils/currency';

interface RefundsTabProps {
  invoiceId: number;
}

export const RefundsTab: React.FC<RefundsTabProps> = ({ invoiceId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RefundHistoryResponse | null>(null);
  const { formatCurrency } = useCurrencyFormatter();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await invoicesService.refundHistory(invoiceId);
        if (mounted) setData(resp);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.error || 'Failed to load refunds');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Refunds</Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              Total Refunded: {formatCurrency(data.total_refunded)}
            </Typography>
          )}
        </Box>
        {loading ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : !data || data.refund_count === 0 ? (
          <Typography color="text.secondary">No refunds.</Typography>
        ) : (
          <List>
            {data.refunds.map((r) => (
              <ListItem key={r.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" fontWeight={600}>
                        Refund {r.refund_method ? `- ${r.refund_method}` : ''}
                      </Typography>
                      <Typography variant="body1" fontWeight={700} color={'error.main'}>
                        -{formatCurrency(r.amount)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      {r.processed_at && (
                        <Typography variant="caption" display="block">
                          {dayjs(r.processed_at).format('MMM D, YYYY h:mm A')}
                        </Typography>
                      )}
                      {r.reference && (
                        <Typography variant="caption" display="block">Ref: {r.reference}</Typography>
                      )}
                      {r.transaction_id && (
                        <Typography variant="caption" display="block">Txn: {r.transaction_id}</Typography>
                      )}
                      {r.reason && (
                        <Typography variant="caption" display="block" color="text.secondary">{r.reason}</Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};


