import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  MenuItem,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  ButtonGroup
} from '@mui/material';
import { api } from '../services/api';

// ============================================================================
// Constants
// ============================================================================

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WORK_TYPES = ['Workday', 'Day Off'] as const;

// Shifts are fully driven from backend configurations. We keep a 'custom' entry for free editing.

// Allow dynamic shift keys (e.g., config_123) in addition to predefined ones
type ShiftKey = string;

// Generate time options with 30-minute intervals (00:00 to 23:30)
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`);
    options.push(`${String(h).padStart(2, '0')}:30`);
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

// ============================================================================
// Types
// ============================================================================

type WorkType = typeof WORK_TYPES[number];

type DaySchedule = {
  day: string;
  type: WorkType;
  shift: ShiftKey;
  start: string;
  end: string;
  lunchStart: string;
  lunchEnd: string;
};

type Employee = {
  id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type StatusMessage = {
  type: 'success' | 'error' | 'info';
  msg: string;
};

type ShiftConfiguration = {
  id?: number;
  name: string;
  start_time: string;
  end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  is_active: boolean;
  is_default: boolean;
};

type ScheduleApiRow = {
  id?: number;
  employee: number;
  day_of_week: number;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  lunch_start_time: string | null;
  lunch_end_time: string | null;
  effective_from: string | null;
};

// ============================================================================
// Helper Functions
// ============================================================================

const getTodayDateString = (): string => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getWeekStartLocal = (refDate: string): string => {
  const date = new Date(refDate + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  return weekStart.toISOString().split('T')[0];
};

const getWeekEndLocal = (startIsoDateOnly: string): string => {
  const start = new Date(startIsoDateOnly + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end.toISOString().split('T')[0];
};

const formatDateRange = (startIso: string, endIso: string): string => {
  const formatDate = (iso: string) => {
    const date = new Date(iso + 'T00:00:00');
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  };
  return `${formatDate(startIso)} - ${formatDate(endIso)}`;
};

const ensureTimeWithSeconds = (time?: string | null): string | null => {
  if (!time) return null;
  return time.length === 5 ? `${time}:00` : time;
};

const formatTimeFromApi = (time?: string | null): string => {
  if (!time) return '';
  const parts = String(time).split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

const getEmployeeName = (emp: Employee): string => {
  return (
    emp.full_name ||
    `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() ||
    `Employee #${emp.id}`
  );
};

const isCurrentWeek = (weekStartDate: string): boolean => {
  const today = new Date();
  const currentWeekStart = getWeekStartLocal(today.toISOString().split('T')[0]);
  return weekStartDate === currentWeekStart;
};

const convertShiftConfigToTemplate = (config: ShiftConfiguration) => ({
  name: config.name,
  start: config.start_time,
  end: config.end_time,
  lunchStart: config.lunch_start_time,
  lunchEnd: config.lunch_end_time
});

// Provide a very basic initial schedule; will be replaced after configs load
const createInitialSchedule = (): DaySchedule[] => {
  return DAYS.map((dayName) => ({
    day: dayName,
    type: 'Workday' as WorkType,
    shift: 'custom' as ShiftKey,
    start: '09:00',
    end: '17:00',
    lunchStart: '12:00',
    lunchEnd: '12:30'
  }));
};

// ============================================================================
// Main Component
// ============================================================================

export const EmployeeSchedules: React.FC = () => {
  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  // Removed unused preservePto/ignoreConflicts; add back when backend supports these options
  const [alsoUpdateDefault, setAlsoUpdateDefault] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekRefDate, setWeekRefDate] = useState<string>(getTodayDateString);
  const [schedule, setSchedule] = useState<DaySchedule[]>(createInitialSchedule);
  const [shiftConfigurations, setShiftConfigurations] = useState<ShiftConfiguration[]>([]);
  // Shift configurations are managed centrally; this page consumes them read-only

  // ============================================================================
  // Callbacks
  // ============================================================================

  // Build the current set of shift templates from backend (plus 'custom')
  const currentShiftTemplates = useMemo(() => {
    const templates: Record<string, { name: string; start: string; end: string; lunchStart: string; lunchEnd: string } > = {};

    templates.custom = {
      name: 'Custom',
      start: '11:00',
      end: '23:00',
      lunchStart: '18:00',
      lunchEnd: '18:30',
    };

    shiftConfigurations.forEach((config, index) => {
      if (config.is_active) {
        const key = `config_${config.id ?? index}`;
        templates[key] = convertShiftConfigToTemplate(config);
      }
    });

    return templates;
  }, [shiftConfigurations]);

  // Detect a shift key by matching its times to configured templates
  const detectShiftKeyForTimes = useCallback((scheduleTimes: { start: string; end: string; lunchStart: string; lunchEnd: string }): ShiftKey => {
    const templates = currentShiftTemplates;
    for (const [key, template] of Object.entries(templates)) {
      if (
        scheduleTimes.start === template.start &&
        scheduleTimes.end === template.end &&
        scheduleTimes.lunchStart === template.lunchStart &&
        scheduleTimes.lunchEnd === template.lunchEnd
      ) {
        return key;
      }
    }
    return 'custom';
  }, [currentShiftTemplates]);

  // Compute the default day schedule based on configured default or fallback
  const getDefaultDaySchedule = useCallback((dayName: string): DaySchedule => {
    const defaultConfig = shiftConfigurations.find(sc => sc.is_default);
    if (defaultConfig) {
      const key = `config_${defaultConfig.id}`;
      const t = currentShiftTemplates[key];
      if (t) {
        return { day: dayName, type: 'Workday', shift: key as ShiftKey, start: t.start, end: t.end, lunchStart: t.lunchStart, lunchEnd: t.lunchEnd };
      }
    }
    return { day: dayName, type: 'Workday', shift: 'custom', start: '09:00', end: '17:00', lunchStart: '12:00', lunchEnd: '12:30' };
  }, [shiftConfigurations, currentShiftTemplates]);

  const updateRow = useCallback((idx: number, key: keyof DaySchedule, value: string) => {
    setSchedule((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }, []);

  const applyShiftToRow = useCallback((idx: number, shiftKey: ShiftKey) => {
    const templates = currentShiftTemplates;
    const template = templates[shiftKey];
    if (!template) return;
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              shift: shiftKey,
              start: template.start,
              end: template.end,
              lunchStart: template.lunchStart,
              lunchEnd: template.lunchEnd
            }
          : row
      )
    );
  }, [currentShiftTemplates]);

  const applyShiftToAll = useCallback((shiftKey: ShiftKey) => {
    const templates = currentShiftTemplates;
    const template = templates[shiftKey];
    if (!template) return;
    setSchedule((prev) =>
      prev.map((row) =>
        row.type === 'Workday'
          ? {
              ...row,
              shift: shiftKey,
              start: template.start,
              end: template.end,
              lunchStart: template.lunchStart,
              lunchEnd: template.lunchEnd
            }
          : row
      )
    );
  }, [currentShiftTemplates]);

  // Simple schedule validation
  const validateSchedule = useCallback((sched: DaySchedule[]): string | null => {
    for (const day of sched) {
      if (day.type === 'Day Off') continue;
      if (day.start >= day.end) return `${day.day}: End time must be after start time`;
      if (day.lunchStart < day.start || day.lunchEnd > day.end) return `${day.day}: Lunch must be within work hours`;
    }
    return null;
  }, []);

  const copyPreviousDay = useCallback((idx: number) => {
    if (idx <= 0) return;
    setSchedule((prev) =>
      prev.map((row, i) => (i === idx ? { ...prev[i - 1], day: row.day } : row))
    );
  }, []);

  const shiftWeek = useCallback((direction: -1 | 1) => {
    setWeekRefDate((currentDate) => {
      const date = new Date(currentDate + 'T00:00:00');
      date.setDate(date.getDate() + 7 * direction);
      return date.toISOString().split('T')[0];
    });
  }, []);

  

  

  // ============================================================================
  // API Functions
  // ============================================================================

  const fetchSchedulesForWeek = async (
    employeeId: number,
    effectiveFrom: string
  ): Promise<ScheduleApiRow[]> => {
    try {
      const res = await api.get('/employee-weekly-schedules/', {
        params: { employee: employeeId, effective_from: effectiveFrom }
      });
      return (res.data?.results ?? res.data ?? []) as ScheduleApiRow[];
    } catch (error) {
      console.error('Failed to fetch weekly schedules:', error);
      return [];
    }
  };

  const fetchDefaultSchedules = async (employeeId: number): Promise<ScheduleApiRow[]> => {
    try {
      const res = await api.get('/employee-weekly-schedules/', {
        params: {
          employee: employeeId,
          'effective_from__isnull': 'true'
        }
      });
      return (res.data?.results ?? res.data ?? []) as ScheduleApiRow[];
    } catch (error) {
      console.error('Failed to fetch default schedules:', error);
      return [];
    }
  };

  const upsertSchedule = async (
    payload: Partial<ScheduleApiRow>,
    existingId?: number
  ): Promise<void> => {
    if (existingId) {
      await api.patch(`/employee-weekly-schedules/${existingId}/`, payload);
    } else {
      await api.post('/employee-weekly-schedules/', payload);
    }
  };

  const fetchShiftConfigurations = async (): Promise<ShiftConfiguration[]> => {
    try {
      const res = await api.get('/shift-configurations/');
      return res.data?.results ?? res.data ?? [];
    } catch (error) {
      console.error('Failed to fetch shift configurations:', error);
      return [];
    }
  };

  // No create/update/delete here; managed in Configuration Manager

  const createSchedulePayload = (
    row: DaySchedule,
    dayIndex: number,
    employeeId: number,
    effectiveFrom: string | null
  ): Partial<ScheduleApiRow> => {
    const isDayOff = row.type !== 'Workday';
    return {
      employee: employeeId,
      day_of_week: dayIndex,
      is_day_off: isDayOff,
      start_time: isDayOff ? null : ensureTimeWithSeconds(row.start),
      end_time: isDayOff ? null : ensureTimeWithSeconds(row.end),
      lunch_start_time: isDayOff ? null : ensureTimeWithSeconds(row.lunchStart),
      lunch_end_time: isDayOff ? null : ensureTimeWithSeconds(row.lunchEnd),
      effective_from: effectiveFrom
    };
  };

  const handleSave = async () => {
    setStatus(null);

    if (!selectedEmployeeId) {
      setStatus({ type: 'error', msg: 'Please select an employee' });
      return;
    }

    setLoading(true);
    const effectiveFrom = getWeekStartLocal(weekRefDate);
    const employeeId = Number(selectedEmployeeId);

    try {
      const validationError = validateSchedule(schedule);
      if (validationError) {
        setStatus({ type: 'error', msg: validationError });
        setLoading(false);
        return;
      }
      // Fetch existing schedules
      const [weeklySchedules, defaultSchedules] = await Promise.all([
        fetchSchedulesForWeek(employeeId, effectiveFrom),
        alsoUpdateDefault ? fetchDefaultSchedules(employeeId) : Promise.resolve([])
      ]);

      // Create lookup maps
      const weeklyByDay = Object.fromEntries(
        weeklySchedules.map((r) => [Number(r.day_of_week), r])
      );
      const defaultsByDay = Object.fromEntries(
        defaultSchedules.map((r) => [Number(r.day_of_week), r])
      );

      // Save weekly schedules
      await Promise.all(
        schedule.map(async (row, idx) => {
          const payload = createSchedulePayload(row, idx, employeeId, effectiveFrom);
          const existingRow = weeklyByDay[idx];
          await upsertSchedule(payload, existingRow?.id);
        })
      );

      // Save default schedules if requested
      if (alsoUpdateDefault) {
        await Promise.all(
          schedule.map(async (row, idx) => {
            const payload = createSchedulePayload(row, idx, employeeId, null);
            const existingRow = defaultsByDay[idx];
            await upsertSchedule(payload, existingRow?.id);
          })
        );
      }

      setStatus({ type: 'success', msg: 'Schedule saved successfully!' });
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to save schedule. Please try again.';
      console.error('Save schedule error:', error);
      setStatus({ type: 'error', msg: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Load employees and shift configurations on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [employeesRes, shiftConfigsRes] = await Promise.all([
          api.get('/employees/'),
          fetchShiftConfigurations()
        ]);
        setEmployees(employeesRes.data.results ?? employeesRes.data ?? []);
        setShiftConfigurations(shiftConfigsRes);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setEmployees([]);
        setShiftConfigurations([]);
      }
    };
    loadInitialData();
  }, []);

  // Load schedule when employee or week changes
  useEffect(() => {
    const loadSchedule = async () => {
      if (!selectedEmployeeId) {
        // build default schedule from current templates
        setSchedule(DAYS.map((day) => getDefaultDaySchedule(day)));
        return;
      }

      setLoading(true);
      try {
        const effectiveFrom = getWeekStartLocal(weekRefDate);
        const employeeId = Number(selectedEmployeeId);

        const [weeklySchedules, defaultSchedules] = await Promise.all([
          fetchSchedulesForWeek(employeeId, effectiveFrom),
          fetchDefaultSchedules(employeeId)
        ]);

        // Merge: defaults first, then weekly overrides
        const scheduleByDay: Record<number, ScheduleApiRow> = {};
        [...defaultSchedules, ...weeklySchedules].forEach((r) => {
          scheduleByDay[Number(r.day_of_week)] = r;
        });

        // Convert API data to UI format
        const newSchedule = DAYS.map((dayName, idx) => {
          const row = scheduleByDay[idx];

          if (!row) {
            return getDefaultDaySchedule(dayName);
          }

          if (row.is_day_off) {
            return {
              day: dayName,
              type: 'Day Off' as WorkType,
              shift: 'custom' as ShiftKey,
              start: '11:00',
              end: '23:00',
              lunchStart: '18:00',
              lunchEnd: '18:30'
            };
          }

          const times = {
            start: formatTimeFromApi(row.start_time) || '11:00',
            end: formatTimeFromApi(row.end_time) || '23:00',
            lunchStart: formatTimeFromApi(row.lunch_start_time) || '18:00',
            lunchEnd: formatTimeFromApi(row.lunch_end_time) || '18:30'
          };

          return {
            day: dayName,
            type: 'Workday' as WorkType,
            shift: detectShiftKeyForTimes(times),
            ...times
          };
        });

        setSchedule(newSchedule);
      } catch (error) {
        console.error('Failed to load schedule:', error);
        setSchedule(createInitialSchedule());
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [selectedEmployeeId, weekRefDate]);

  // ============================================================================
  // Render
  // ============================================================================

  const weekStart = getWeekStartLocal(weekRefDate);
  const weekEnd = getWeekEndLocal(weekStart);
  const weekDisplay = formatDateRange(weekStart, weekEnd);
  const isCurrentWeekDisplayed = isCurrentWeek(weekStart);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Employee Weekly Schedules
      </Typography>

      {/* Employee Selector */}
      <Box sx={{ mb: 3 }}>
        <TextField
          select
          size="small"
          label="Select Employee"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(Number(e.target.value) || '')}
          sx={{ minWidth: 300 }}
        >
          <MenuItem value="">
            <em>Select an employee...</em>
          </MenuItem>
          {employees.map((emp) => (
            <MenuItem key={emp.id} value={emp.id}>
              {getEmployeeName(emp)}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* Status Alert */}
        {status && (
          <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
            {status.msg}
          </Alert>
        )}

        {/* Quick Apply Shifts */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Quick Apply Shift to All Workdays:
            </Typography>
          </Box>
          <ButtonGroup variant="outlined" size="small">
              {Object.entries(currentShiftTemplates).map(([key, template]) => (
              <Button key={key} onClick={() => applyShiftToAll(key as ShiftKey)}>
                {template.name} ({template.start}-{template.end})
              </Button>
            ))}
          </ButtonGroup>
        </Box>


        {/* Loading Indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, mb: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Schedule Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Day</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Shift</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>Start Time</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>End Time</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>Lunch Start</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>Lunch End</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule.map((row, idx) => {
                const isDayOff = row.type === 'Day Off';
                const isDisabled = !selectedEmployeeId || loading;
                const isCustomShift = row.shift === 'custom';

                return (
                  <TableRow key={row.day} hover>
                    <TableCell sx={{ opacity: isDayOff ? 0.6 : 1 }}>{row.day}</TableCell>
                    
                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.type}
                        onChange={(e) => updateRow(idx, 'type', e.target.value)}
                        disabled={isDisabled}
                      >
                        {WORK_TYPES.map((wt) => (
                          <MenuItem key={wt} value={wt}>
                            {wt}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.shift}
                        onChange={(e) => applyShiftToRow(idx, e.target.value as ShiftKey)}
                        disabled={isDisabled || isDayOff}
                        sx={{ opacity: isDayOff ? 0.5 : 1 }}
                      >
                        {Object.entries(currentShiftTemplates).map(([key, template]) => (
                          <MenuItem key={key} value={key as string}>
                            {template.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.start}
                        onChange={(e) => {
                          setSchedule((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, start: e.target.value, shift: 'custom' } : r
                            )
                          );
                        }}
                        disabled={isDisabled || isDayOff || !isCustomShift}
                        sx={{ 
                          opacity: isDayOff || !isCustomShift ? 0.5 : 1,
                          bgcolor: !isCustomShift && !isDayOff ? 'action.hover' : 'inherit'
                        }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.end}
                        onChange={(e) => {
                          setSchedule((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, end: e.target.value, shift: 'custom' } : r
                            )
                          );
                        }}
                        disabled={isDisabled || isDayOff || !isCustomShift}
                        sx={{ 
                          opacity: isDayOff || !isCustomShift ? 0.5 : 1,
                          bgcolor: !isCustomShift && !isDayOff ? 'action.hover' : 'inherit'
                        }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.lunchStart}
                        onChange={(e) => {
                          setSchedule((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, lunchStart: e.target.value, shift: 'custom' } : r
                            )
                          );
                        }}
                        disabled={isDisabled || isDayOff || !isCustomShift}
                        sx={{ 
                          opacity: isDayOff || !isCustomShift ? 0.5 : 1,
                          bgcolor: !isCustomShift && !isDayOff ? 'action.hover' : 'inherit'
                        }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.lunchEnd}
                        onChange={(e) => {
                          setSchedule((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, lunchEnd: e.target.value, shift: 'custom' } : r
                            )
                          );
                        }}
                        disabled={isDisabled || isDayOff || !isCustomShift}
                        sx={{ 
                          opacity: isDayOff || !isCustomShift ? 0.5 : 1,
                          bgcolor: !isCustomShift && !isDayOff ? 'action.hover' : 'inherit'
                        }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => copyPreviousDay(idx)}
                        disabled={isDisabled || idx === 0}
                      >
                        Copy Previous
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Week Navigation and Options */}
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Week Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                label="Week of"
                value={weekDisplay}
                InputProps={{ readOnly: true }}
                sx={{ 
                  minWidth: 200,
                  ...(isCurrentWeekDisplayed && {
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText',
                      '& fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: 2,
                      },
                      '&:hover fieldset': {
                        borderColor: 'primary.dark',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'primary.main',
                      fontWeight: 600,
                    },
                  })
                }}
              />
              {isCurrentWeekDisplayed && (
                <Box
                  sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Current Week
                </Box>
              )}
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => shiftWeek(-1)}
              disabled={loading}
            >
              ← Previous Week
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => shiftWeek(1)}
              disabled={loading}
            >
              Next Week →
            </Button>
            {!isCurrentWeekDisplayed && (
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const today = new Date();
                  setWeekRefDate(today.toISOString().split('T')[0]);
                }}
                disabled={loading}
                sx={{ ml: 1 }}
              >
                Go to Current Week
              </Button>
            )}
          </Box>

          {/* Options */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={alsoUpdateDefault}
                  onChange={(e) => setAlsoUpdateDefault(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Also update default template"
            />
          </Box>

          {/* Warning */}
          {alsoUpdateDefault && (
            <Alert severity="warning">
              <strong>Warning:</strong> Updating the default schedule will override all future
              weekly schedules that haven't been explicitly customized.
            </Alert>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button variant="outlined" onClick={() => setStatus(null)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!selectedEmployeeId || loading}
            >
              {loading ? 'Saving...' : 'Save Schedule'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default EmployeeSchedules;