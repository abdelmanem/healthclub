import React, { useState, useEffect, useCallback } from 'react';
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

// Predefined shift templates
const SHIFT_TEMPLATES = {
  morning: {
    name: 'Morning Shift',
    start: '07:00',
    end: '15:00',
    lunchStart: '11:00',
    lunchEnd: '11:30'
  },
  afternoon: {
    name: 'Afternoon Shift',
    start: '15:00',
    end: '23:00',
    lunchStart: '18:00',
    lunchEnd: '18:30'
  },
  night: {
    name: 'Night Shift',
    start: '23:00',
    end: '07:00',
    lunchStart: '02:00',
    lunchEnd: '02:30'
  },
  custom: {
    name: 'Custom',
    start: '11:00',
    end: '23:00',
    lunchStart: '18:00',
    lunchEnd: '18:30'
  }
} as const;

type ShiftType = keyof typeof SHIFT_TEMPLATES;

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
  shift: ShiftType;
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

const detectShiftType = (schedule: Omit<DaySchedule, 'day' | 'type' | 'shift'>): ShiftType => {
  // Check if times match any predefined shift
  for (const [key, template] of Object.entries(SHIFT_TEMPLATES)) {
    if (
      schedule.start === template.start &&
      schedule.end === template.end &&
      schedule.lunchStart === template.lunchStart &&
      schedule.lunchEnd === template.lunchEnd
    ) {
      return key as ShiftType;
    }
  }
  return 'custom';
};

const createDefaultSchedule = (): DaySchedule[] => {
  return DAYS.map((dayName) => ({
    day: dayName,
    type: 'Workday' as WorkType,
    shift: 'afternoon' as ShiftType,
    start: '15:00',
    end: '23:00',
    lunchStart: '18:00',
    lunchEnd: '18:30'
  }));
};

// ============================================================================
// Main Component
// ============================================================================

export const EmployeeSchedules: React.FC = () => {
  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [preservePto, setPreservePto] = useState(true);
  const [ignoreConflicts, setIgnoreConflicts] = useState(false);
  const [alsoUpdateDefault, setAlsoUpdateDefault] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekRefDate, setWeekRefDate] = useState<string>(getTodayDateString);
  const [schedule, setSchedule] = useState<DaySchedule[]>(createDefaultSchedule);

  // ============================================================================
  // Callbacks
  // ============================================================================

  const updateRow = useCallback((idx: number, key: keyof DaySchedule, value: string) => {
    setSchedule((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }, []);

  const applyShiftToRow = useCallback((idx: number, shiftType: ShiftType) => {
    const template = SHIFT_TEMPLATES[shiftType];
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              shift: shiftType,
              start: template.start,
              end: template.end,
              lunchStart: template.lunchStart,
              lunchEnd: template.lunchEnd
            }
          : row
      )
    );
  }, []);

  const applyShiftToAll = useCallback((shiftType: ShiftType) => {
    const template = SHIFT_TEMPLATES[shiftType];
    setSchedule((prev) =>
      prev.map((row) =>
        row.type === 'Workday'
          ? {
              ...row,
              shift: shiftType,
              start: template.start,
              end: template.end,
              lunchStart: template.lunchStart,
              lunchEnd: template.lunchEnd
            }
          : row
      )
    );
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
  // const shiftWeek = useCallback((direction: -1 | 1) => {
  //   setWeekRefDate((currentDate) => {
  //     const weekStart = getWeekStartLocal(currentDate);
  //     const date = new Date(weekStart + 'T00:00:00');
  //     date.setDate(date.getDate() + 7 * direction);
  //     return date.toISOString().split('T')[0];
  //   });
  // }, []);

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

  // Load employees on mount
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await api.get('/employees/');
        setEmployees(res.data.results ?? res.data ?? []);
      } catch (error) {
        console.error('Failed to load employees:', error);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  // Load schedule when employee or week changes
  useEffect(() => {
    const loadSchedule = async () => {
      if (!selectedEmployeeId) {
        setSchedule(createDefaultSchedule());
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
            return {
              day: dayName,
              type: 'Workday' as WorkType,
              shift: 'afternoon' as ShiftType,
              start: '15:00',
              end: '23:00',
              lunchStart: '18:00',
              lunchEnd: '18:30'
            };
          }

          if (row.is_day_off) {
            return {
              day: dayName,
              type: 'Day Off' as WorkType,
              shift: 'custom' as ShiftType,
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
            shift: detectShiftType(times),
            ...times
          };
        });

        setSchedule(newSchedule);
      } catch (error) {
        console.error('Failed to load schedule:', error);
        setSchedule(createDefaultSchedule());
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
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Quick Apply Shift to All Workdays:
          </Typography>
          <ButtonGroup variant="outlined" size="small">
            <Button onClick={() => applyShiftToAll('morning')}>
              Morning (7:00-15:00)
            </Button>
            <Button onClick={() => applyShiftToAll('afternoon')}>
              Afternoon (15:00-23:00)
            </Button>
            <Button onClick={() => applyShiftToAll('night')}>
              Night (23:00-7:00)
            </Button>
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
                        onChange={(e) => applyShiftToRow(idx, e.target.value as ShiftType)}
                        disabled={isDisabled || isDayOff}
                        sx={{ opacity: isDayOff ? 0.5 : 1 }}
                      >
                        {Object.entries(SHIFT_TEMPLATES).map(([key, template]) => (
                          <MenuItem key={key} value={key}>
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
            <TextField
              size="small"
              label="Week of"
              value={weekDisplay}
              InputProps={{ readOnly: true }}
              sx={{ minWidth: 200 }}
            />
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
          </Box>

          {/* Options */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preservePto}
                  onChange={(e) => setPreservePto(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Preserve vacation and personal days"
            />
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
            <FormControlLabel
              control={
                <Checkbox
                  checked={ignoreConflicts}
                  onChange={(e) => setIgnoreConflicts(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Ignore schedule conflicts"
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