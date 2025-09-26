import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography, SelectChangeEvent, Tabs, Tab } from '@mui/material';
import { Refresh, PlayArrow, CheckCircle, Cancel } from '@mui/icons-material';
import { housekeepingApi, HousekeepingTask } from '../services/housekeeping';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { employeesApi, EmployeeOption } from '../services/employees';
import { locationsApi, Location } from '../services/locations';

const StatusChip: React.FC<{ status: HousekeepingTask['status'] }> = ({ status }) => {
  const color = status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : status === 'cancelled' ? 'default' : 'info';
  return <Chip label={status.replace('_', ' ')} color={color as any} size="small" />;
};

export const Housekeeping: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filters, setFilters] = useState<{ status?: string }>({});
  const [tab, setTab] = useState<'tasks' | 'rooms'>('tasks');
  const [rooms, setRooms] = useState<Location[]>([]);
  const [roomFilters, setRoomFilters] = useState<{ gender?: string; is_clean?: string; is_occupied?: string }>({});

  const load = async (): Promise<void> => {
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

  useEffect((): void => {
    load();
    employeesApi.options().then(setEmployees).catch(() => setEmployees([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRooms = async (): Promise<void> => {
    const params: Record<string, any> = { ordering: 'name' };
    if (roomFilters.gender) params.gender = roomFilters.gender;
    if (roomFilters.is_clean) params.is_clean = roomFilters.is_clean;
    if (roomFilters.is_occupied) params.is_occupied = roomFilters.is_occupied;
    const data = await locationsApi.list(params);
    setRooms(data);
  };

  const handleStart = async (id: number): Promise<void> => {
    await housekeepingApi.start(id);
    await load();
  };
  const handleComplete = async (id: number): Promise<void> => {
    await housekeepingApi.complete(id);
    await load();
  };
  const handleCancel = async (id: number): Promise<void> => {
    await housekeepingApi.cancel(id);
    await load();
  };

  const handleStatusFilterChange = async (e: SelectChangeEvent<string>): Promise<void> => {
    const value = e.target.value as string;
    setFilters({ ...filters, status: value || undefined });
  };

  const handleAssignChange = async (taskId: number, e: SelectChangeEvent<string>): Promise<void> => {
    const value = e.target.value as string;
    const assigned_to = value ? Number(value) : null;
    await housekeepingApi.update(taskId, { assigned_to } as any);
    await load();
  };

  const handleTabChange = async (_event: React.SyntheticEvent, value: 'tasks' | 'rooms'): Promise<void> => {
    setTab(value);
    if (value === 'rooms') await loadRooms();
  };

  if (loading) return <LoadingSpinner message="Loading housekeeping tasks..." />;

  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Housekeeping</Typography>
      </Stack>
      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Tasks" value="tasks" />
        <Tab label="Rooms" value="rooms" />
      </Tabs>
      {tab === 'tasks' && (
        <>
          <Stack direction="row" spacing={2} mb={2}>
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
          <Stack spacing={2}>
            {tasks.map((t: HousekeepingTask) => (
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
                      onChange={(e: SelectChangeEvent<string>) => handleAssignChange(t.id, e)}
                      sx={{ minWidth: 180 }}
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {employees.map((emp: EmployeeOption) => (
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
        </>
      )}
      {tab === 'rooms' && (
        <>
          <Stack direction="row" spacing={2} mb={2}>
            <TextField select size="small" label="Gender" sx={{ minWidth: 160 }} value={roomFilters.gender || ''}
              onChange={(e: SelectChangeEvent<string>) => setRoomFilters({ ...roomFilters, gender: e.target.value || undefined })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="unisex">Unisex</MenuItem>
            </TextField>
            <TextField select size="small" label="Clean" sx={{ minWidth: 160 }} value={roomFilters.is_clean || ''}
              onChange={(e: SelectChangeEvent<string>) => setRoomFilters({ ...roomFilters, is_clean: e.target.value || undefined })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Clean</MenuItem>
              <MenuItem value="false">Dirty</MenuItem>
            </TextField>
            <TextField select size="small" label="Occupied" sx={{ minWidth: 160 }} value={roomFilters.is_occupied || ''}
              onChange={(e: SelectChangeEvent<string>) => setRoomFilters({ ...roomFilters, is_occupied: e.target.value || undefined })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Occupied</MenuItem>
              <MenuItem value="false">Vacant</MenuItem>
            </TextField>
            <Button startIcon={<Refresh />} onClick={loadRooms}>Refresh</Button>
          </Stack>
          <Stack spacing={2}>
            {rooms.map((r: Location) => (
              <Paper key={r.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1">{r.name}</Typography>
                    <Stack direction="row" spacing={1} mt={1}>
                      <Chip label={`Gender: ${r.gender}`} size="small" />
                      <Chip label={r.is_clean ? 'Clean' : 'Dirty'} color={r.is_clean ? 'success' : 'warning'} size="small" />
                      <Chip label={r.is_occupied ? 'Occupied' : 'Vacant'} color={r.is_occupied ? 'warning' : 'info'} size="small" />
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={async (): Promise<void> => { await locationsApi.markClean(r.id); await loadRooms(); }}>Mark Clean</Button>
                    <Button size="small" onClick={async (): Promise<void> => { await locationsApi.markDirty(r.id); await loadRooms(); }}>Mark Dirty</Button>
                    <Button size="small" onClick={async (): Promise<void> => { await locationsApi.markVacant(r.id); await loadRooms(); }} disabled={!r.is_occupied}>Mark Vacant</Button>
                    <Button size="small" onClick={async (): Promise<void> => { await locationsApi.markOccupied(r.id); await loadRooms(); }} disabled={r.is_occupied}>Mark Occupied</Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
            {!rooms.length && (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography>No rooms match the current filters.</Typography>
              </Paper>
            )}
          </Stack>
        </>
      )}
      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" color="text.secondary">Tasks auto-create on reservation checkout and completing a task sets the room to clean.</Typography>
    </Box>
  );
};

export default Housekeeping;

