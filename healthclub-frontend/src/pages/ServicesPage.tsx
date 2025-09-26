import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography, Grid, Chip, Autocomplete } from '@mui/material';
import { servicesApi, ServiceInput, ServiceRecord } from '../services/services';
import { locationsApi, Location } from '../services/locations';

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<ServiceInput>({ name: '', duration_minutes: 60, price: 0, description: '', locations: [] });
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);

  const load = async () => {
    const [svc, loc] = await Promise.all([
      servicesApi.list(),
      locationsApi.list({ is_active: true }),
    ]);
    setServices(svc);
    setLocations(loc);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ServiceInput = {
      ...form,
      duration_minutes: Number(form.duration_minutes),
      price: Number(form.price),
      locations: selectedLocations.map(l => l.id),
    };
    await servicesApi.create(payload);
    setForm({ name: '', duration_minutes: 60, price: 0, description: '', locations: [] });
    setSelectedLocations([]);
    await load();
  };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Create Service</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={submit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField type="number" label="Duration (min)" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} fullWidth required />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField type="number" label="Price" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} fullWidth required />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline minRows={2} />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={locations}
                value={selectedLocations}
                onChange={(_, val) => setSelectedLocations(val as Location[])}
                getOptionLabel={(o) => `${o.name} ${o.is_out_of_service ? '(OOS)' : ''}`.trim()}
                renderInput={(params) => <TextField {...params} label="Link Rooms (optional)" />}
              />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained">Create Service</Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Typography variant="h6" gutterBottom>Existing Services</Typography>
      <Stack spacing={1}>
        {services.map(s => (
          <Paper key={s.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1">{s.name}</Typography>
                <Typography variant="body2" color="text.secondary">{s.description}</Typography>
                <Stack direction="row" spacing={1} mt={1}>
                  <Chip label={`${s.duration_minutes} min`} size="small" />
                  <Chip label={`$${Number(s.price).toFixed(2)}`} size="small" />
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Typography variant="caption" color="text.secondary">ID: {s.id}</Typography>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default ServicesPage;

