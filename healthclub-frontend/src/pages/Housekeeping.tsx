import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import { Refresh, PlayArrow, CheckCircle, Cancel } from '@mui/icons-material';
import { housekeepingApi, HousekeepingTask } from '../services/housekeeping';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const StatusChip: React.FC<{ status: HousekeepingTask['status'] }> = ({ status }) => {
  const color = status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : status === 'cancelled' ? 'default' : 'info';
  return <Chip label={status.replace('_', ' ')} color={color as any} size="small" />;
};

export const Housekeeping: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await housekeepingApi.list({ ordering: '-created_at' });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStart = async (id: number) => {
    await housekeepingApi.start(id);
    await load();
  };
  const handleComplete = async (id: number) => {
    await housekeepingApi.complete(id);
    await load();
  };
  const handleCancel = async (id: number) => {
    await housekeepingApi.cancel(id);
    await load();
  };

  if (loading) return <LoadingSpinner message="Loading housekeeping tasks..." />;

  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Housekeeping</Typography>
        <Button startIcon={<Refresh />} onClick={load}>Refresh</Button>
      </Stack>
      <Stack spacing={2}>
        {tasks.map((t) => (
          <Paper key={t.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1">{t.location_name || `Room #${t.location}`}</Typography>
                <Typography variant="body2" color="text.secondary">Task #{t.id}</Typography>
                <Stack direction="row" spacing={1} mt={1}>
                  <StatusChip status={t.status} />
                  {t.started_at && <Chip label={`Started: ${new Date(t.started_at).toLocaleString()}`} size="small" />}
                  {t.completed_at && <Chip label={`Completed: ${new Date(t.completed_at).toLocaleString()}`} size="small" color="success" />}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <IconButton aria-label="start" onClick={() => handleStart(t.id)} disabled={t.status !== 'pending'}>
                  <PlayArrow />
                </IconButton>
                <IconButton aria-label="complete" onClick={() => handleComplete(t.id)} disabled={!(t.status === 'pending' || t.status === 'in_progress')}>
                  <CheckCircle />
                </IconButton>
                <IconButton aria-label="cancel" onClick={() => handleCancel(t.id)} disabled={t.status === 'completed'}>
                  <Cancel />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        ))}
        {!tasks.length && (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography>No housekeeping tasks right now.</Typography>
          </Paper>
        )}
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" color="text.secondary">Tasks auto-create on reservation checkout and completing a task sets the room to clean.</Typography>
    </Box>
  );
};

export default Housekeeping;

