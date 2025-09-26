import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography, SelectChangeEvent } from '@mui/material';
import { Refresh, PlayArrow, CheckCircle, Cancel } from '@mui/icons-material';
import { housekeepingApi, HousekeepingTask } from '../services/housekeeping';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { employeesApi, EmployeeOption } from '../services/employees';

const StatusChip: React.FC<{ status: HousekeepingTask['status'] }> = ({ status }) => {
  const color = status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : status === 'cancelled' ? 'default' : 'info';
  return <Chip label={status.replace('_', ' ')} color={color as any} size="small" />;
};

export const Housekeeping: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filters, setFilters] = useState<{ status?: string }>({});

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { ordering: '-created_at' };
      if (filters.status) params.status = filters.status;
      const data = await housekeepingApi.list(params);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    employeesApi.options().then(setEmployees).catch(() => setEmployees([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleStatusFilterChange = async (e: SelectChangeEvent<string>) => {
    const value = e.target.value as string;
    setFilters({ ...filters, status: value || undefined });
  };

  const handleAssignChange = async (taskId: number, e: SelectChangeEvent<string>) => {
    const value = e.target.value as string;
    const assigned_to = value ? Number(value) : null;
    await housekeepingApi.update(taskId, { assigned_to } as any);
    await load();
  };

  if (loading) return <LoadingSpinner message="Loading housekeeping tasks..." />;

  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Housekeeping</Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            label="Status"
            value={filters.status || ''}
            onChange={handleStatusFilterChange}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
          <Button startIcon={<Refresh />} onClick={() => load()}>Refresh</Button>
        </Stack>
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
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  select
                  size="small"
                  label="Assign"
                  value={t.assigned_to || ''}
                  onChange={(e) => handleAssignChange(t.id, e)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.full_name}</MenuItem>
                  ))}
                </TextField>
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

