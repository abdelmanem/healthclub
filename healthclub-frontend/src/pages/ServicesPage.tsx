import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography, Chip, Autocomplete, CircularProgress, InputAdornment } from '@mui/material';
import { servicesApi, ServiceInput, ServiceRecord, serviceCategoriesApi, ServiceCategoryRecord } from '../services/services';
import { locationsApi, Location } from '../services/locations';
import { PageWrapper } from '../components/common/PageWrapper';
import { useCurrencyFormatter } from '../utils/currency';

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<ServiceInput>({ name: '', duration_minutes: 60, price: 0, description: '', locations: [] });
  const [categories, setCategories] = useState<ServiceCategoryRecord[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ServiceRecord | null>(null);
  const [catForm, setCatForm] = useState<{ name: string; description?: string }>({ name: '', description: '' });
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { formatCurrency, currencySymbol } = useCurrencyFormatter();

  const load = async () => {
    setLoading(true);
    try {
      console.log('Loading services data...');
      const [svc, loc, cat] = await Promise.all([
        servicesApi.list(),
        locationsApi.list({ is_active: true }),
        serviceCategoriesApi.list(),
      ]);
      console.log('Services loaded:', svc);
      console.log('Locations loaded:', loc);
      console.log('Categories loaded:', cat);
      console.log('Categories type:', typeof cat, 'Is array:', Array.isArray(cat));
      
      // Extract results from paginated API responses
      const servicesData = (svc as any)?.results || (Array.isArray(svc) ? svc : []);
      const locationsData = (loc as any)?.results || (Array.isArray(loc) ? loc : []);
      const categoriesData = (cat as any)?.results || (Array.isArray(cat) ? cat : []);
      
      console.log('Extracted services:', servicesData);
      console.log('Extracted locations:', locationsData);
      console.log('Extracted categories:', categoriesData);
      
      setServices(servicesData);
      setLocations(locationsData);
      setCategories(categoriesData);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Set empty arrays as fallback
      setServices([]);
      setLocations([]);
      setCategories([]);
      
      // Show user-friendly error message
      alert(`Failed to load services data: ${error.response?.data?.detail || error.message}. Please check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ServiceInput & { category_id?: number | null } = {
      ...form,
      duration_minutes: Number(form.duration_minutes),
      price: Number(form.price),
      locations: selectedLocations.map(l => l.id),
      ...(categoryId ? { category_id: categoryId } : {}),
    };
    if (editing) {
      await servicesApi.update(editing.id, payload);
    } else {
      await servicesApi.create(payload);
    }
    setForm({ name: '', duration_minutes: 60, price: 0, description: '', locations: [] });
    setSelectedLocations([]);
    setCategoryId(null);
    setEditing(null);
    await load();
  };

  if (loading) {
    return (
      <Box p={2} display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageWrapper
      title={editing ? 'Edit Service' : 'Create Service'}
      subtitle="Manage service offerings and categories"
    >
      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <TextField 
                label="Name" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                sx={{ flex: '1 1 300px', minWidth: 200 }} 
                required 
              />
              <TextField 
                type="number" 
                label="Duration (min)" 
                value={form.duration_minutes} 
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} 
                sx={{ flex: '0 0 150px' }} 
                required 
              />
              <TextField 
                type="number" 
                label="Price" 
                value={form.price} 
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} 
                sx={{ flex: '0 0 150px' }} 
                required 
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography fontWeight={600}>{currencySymbol || ''}</Typography>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Autocomplete
                options={categories}
                value={categories.find(c => c.id === categoryId) || null}
                onChange={(_, val) => setCategoryId(val ? val.id : null)}
                getOptionLabel={(o) => o.name}
                renderInput={(params) => <TextField {...params} label="Category (optional)" />}
                sx={{ flex: '1 1 300px', minWidth: 200 }}
              />
            </Box>
            <TextField 
              label="Description" 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              fullWidth 
              multiline 
              minRows={2} 
            />
            <Autocomplete
              multiple
              options={locations}
              value={selectedLocations}
              onChange={(_, val) => setSelectedLocations(val as Location[])}
              getOptionLabel={(o) => `${o.name} ${o.is_out_of_service ? '(OOS)' : ''}`.trim()}
              renderInput={(params) => <TextField {...params} label="Link Rooms (optional)" />}
            />
            <Button type="submit" variant="contained">Create Service</Button>
          </Stack>
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
                  <Chip label={formatCurrency(s.price)} size="small" />
                  {(s as any).category && <Chip label={(s as any).category.name} size="small" />}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => {
                  setEditing(s);
                  setForm({ name: s.name, description: s.description, duration_minutes: s.duration_minutes, price: Number(s.price), locations: [] });
                  setCategoryId(((s as any).category?.id) || null);
                }}>Edit</Button>
                <Button size="small" color="error" onClick={async () => { await servicesApi.delete(s.id); await load(); }}>Delete</Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Service Categories</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField 
            label="Name" 
            value={catForm.name} 
            onChange={(e)=> setCatForm({ ...catForm, name: e.target.value })} 
            sx={{ flex: '1 1 200px', minWidth: 150 }} 
          />
          <TextField 
            label="Description" 
            value={catForm.description} 
            onChange={(e)=> setCatForm({ ...catForm, description: e.target.value })} 
            sx={{ flex: '2 1 300px', minWidth: 200 }} 
          />
          <Button 
            variant="contained" 
            onClick={async ()=> { await serviceCategoriesApi.create(catForm); setCatForm({ name: '', description: '' }); await load(); }}
            sx={{ flex: '0 0 auto' }}
          >
            Add Category
          </Button>
        </Box>
      </Paper>
      <Stack spacing={1}>
        {(categories || []).map(c => (
          <Paper key={c.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1">{c.name}</Typography>
                <Typography variant="body2" color="text.secondary">{c.description}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={async ()=> { const name = prompt('New name', c.name) || c.name; const description = prompt('New description', c.description || '') || c.description; await serviceCategoriesApi.update(c.id, { name, description }); await load(); }}>Edit</Button>
                <Button size="small" color="error" onClick={async ()=> { await serviceCategoriesApi.delete(c.id); await load(); }}>Delete</Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </PageWrapper>
  );
};

export default ServicesPage;

