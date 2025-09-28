import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Button, Collapse } from '@mui/material';
import { ReservationBookingForm } from '../components/reservation/ReservationBookingForm';
import { reservationsService, Reservation, ReservationService } from '../services/reservations';
import dayjs from 'dayjs';
import { Check, DirectionsRun, DoneAll, Logout, ExpandMore, ExpandLess, Edit } from '@mui/icons-material';

export const ReservationManagement: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [formVersion, setFormVersion] = useState<number>(0);

  const startOfDay = useMemo(() => dayjs().startOf('day').toISOString(), []);
  const endOfDay = useMemo(() => dayjs().endOf('day').toISOString(), []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await reservationsService.list({ start_time__gte: startOfDay, start_time__lte: endOfDay });
      setReservations(data);
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [startOfDay, endOfDay]);

  const handleAction = async (id: number, action: 'check_in' | 'in_service' | 'complete' | 'check_out') => {
    try {
      if (action === 'check_in') await reservationsService.checkIn(id);
      if (action === 'in_service') await reservationsService.inService(id);
      if (action === 'complete') await reservationsService.complete(id);
      if (action === 'check_out') await reservationsService.checkOut(id);
      await loadReservations();
    } catch (e) {
      console.error(`Failed to ${action} reservation`, e);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case 'booked':
        return 'primary';
      case 'checked_in':
      case 'in_service':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'default';
      default:
        return 'info';
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" mb={3}>Reservation Management</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Today's Calendar</Typography>
          <Box mb={2}>
            <Button variant="outlined" size="small" href="/reservations/explore">Open Reservations Explorer</Button>
          </Box>
          {loading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : (
            <Box>
              {reservations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No reservations scheduled for today.</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Guest</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Start time</TableCell>
                      <TableCell>End time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Total Duration</TableCell>
                      <TableCell>Total Price</TableCell>
                      <TableCell align="right">Manage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reservations.map((r) => (
                      <React.Fragment key={r.id}>
                        <TableRow hover>
                          <TableCell>{r.id}</TableCell>
                          <TableCell>{r.guest_name ?? r.guest}</TableCell>
                          <TableCell>{r.location_name ?? r.location ?? '-'}</TableCell>
                          <TableCell>{dayjs(r.start_time).format('MMM D, YYYY, h:mm A')}</TableCell>
                          <TableCell>{r.end_time ? dayjs(r.end_time).format('MMM D, YYYY, h:mm A') : '-'}</TableCell>
                          <TableCell>
                            <Chip label={(r.status ?? 'pending').replace('_', ' ')} color={statusColor(r.status) as any} size="small" />
                          </TableCell>
                          <TableCell>{r.total_duration_minutes ? `${r.total_duration_minutes} min` : '-'}</TableCell>
                          <TableCell>{typeof r.total_price === 'number' ? `$${r.total_price.toFixed(2)}` : '-'}</TableCell>
                          <TableCell align="right">
                            <Tooltip title={expandedRows.has(r.id) ? 'Collapse' : 'Expand'}>
                              <IconButton size="small" onClick={() => toggleExpanded(r.id)}>
                                {expandedRows.has(r.id) ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <span style={{ display: 'inline-flex' }}>
                                <IconButton size="small" onClick={() => setEditing(r)}>
                                  <Edit />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {(() => {
                              const canCheckIn = r.status === 'booked';
                              const canInService = r.status === 'checked_in';
                              const canComplete = r.status === 'in_service';
                              const canCheckOut = r.status === 'completed';
                              return (
                                <>
                                  <Tooltip title="Check-in">
                                    <span style={{ display: 'inline-flex' }}>
                                      <IconButton size="small" onClick={() => handleAction(r.id, 'check_in')}>
                                        <Check />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="In service">
                                    <span style={{ display: 'inline-flex' }}>
                                      <IconButton size="small" onClick={() => handleAction(r.id, 'in_service')}>
                                        <DirectionsRun />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Complete">
                                    <span style={{ display: 'inline-flex' }}>
                                      <IconButton size="small" onClick={() => handleAction(r.id, 'complete')}>
                                        <DoneAll />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Check-out">
                                    <span style={{ display: 'inline-flex' }}>
                                      <IconButton size="small" onClick={() => handleAction(r.id, 'check_out')}>
                                        <Logout />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={9} sx={{ p: 0, border: 0 }}>
                            <Collapse in={expandedRows.has(r.id)}>
                              <Box p={2} bgcolor="grey.50">
                                <Typography variant="subtitle2" gutterBottom>Reservation Details</Typography>
                                <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2}>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">Guest:</Typography>
                                    <Typography variant="body1">{r.guest_name ?? `Guest #${r.guest}`}</Typography>
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">Location:</Typography>
                                    <Typography variant="body1">{r.location_name ?? `Location #${r.location}`}</Typography>
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">Employee:</Typography>
                                    <Typography variant="body1">{r.employee_name ?? 'Not assigned'}</Typography>
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">Services:</Typography>
                                    <Typography variant="body1">
                                      {r.reservation_services && r.reservation_services.length > 0 
                                        ? r.reservation_services.map((rs: ReservationService) => rs.service_details?.name || `Service #${rs.service}`).join(', ')
                                        : 'No services'
                                      }
                                    </Typography>
                                  </Box>
                                  {r.notes && (
                                    <Box gridColumn="span 2">
                                      <Typography variant="body2" color="text.secondary">Notes:</Typography>
                                      <Typography variant="body1">{r.notes}</Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{editing ? 'Edit Reservation' : 'New Reservation'}</Typography>
          <ReservationBookingForm
            key={`rv-${formVersion}-${editing ? editing.id : 'new'}`}
            reservation={editing}
            onCreated={async () => {
              await loadReservations();
              setEditing(null);
              setFormVersion(v => v + 1);
            }}
            onSaved={async () => {
              await loadReservations();
              setEditing(null);
              setFormVersion(v => v + 1);
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};


