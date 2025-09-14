import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Edit, Add, Save, Cancel } from '@mui/icons-material';
import { useConfiguration } from '../../contexts/ConfigurationContext';
import { PermissionGate } from '../common/PermissionGate';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const ConfigurationManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { 
    systemConfigs, 
    membershipTiers, 
    genderOptions, 
    businessRules,
    isLoading 
  } = useConfiguration();

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    console.log('Save configuration:', editingItem);
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading configurations..." />;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        System Configuration
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="System Settings" />
          <Tab label="Membership Tiers" />
          <Tab label="Gender Options" />
          <Tab label="Business Rules" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">System Configuration</Typography>
              <PermissionGate permission="add" model="config">
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAdd}
                >
                  Add Configuration
                </Button>
              </PermissionGate>
            </Box>
            
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(systemConfigs).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell>{String(value)}</TableCell>
                      <TableCell>
                        <Chip label="string" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label="Active" 
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <PermissionGate permission="change" model="config">
                          <IconButton onClick={() => handleEdit({ key, value })}>
                            <Edit />
                          </IconButton>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Membership Tiers
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Display Name</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {membershipTiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>{tier.name}</TableCell>
                      <TableCell>{tier.display_name}</TableCell>
                      <TableCell>{tier.discount_percentage}%</TableCell>
                      <TableCell>
                        <Chip 
                          label={tier.is_active ? 'Active' : 'Inactive'} 
                          color={tier.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <PermissionGate permission="change" model="config">
                          <IconButton onClick={() => handleEdit(tier)}>
                            <Edit />
                          </IconButton>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Gender Options
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Display Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {genderOptions.map((gender) => (
                    <TableRow key={gender.id}>
                      <TableCell>{gender.code}</TableCell>
                      <TableCell>{gender.display_name}</TableCell>
                      <TableCell>{gender.description}</TableCell>
                      <TableCell>
                        <Chip 
                          label={gender.is_active ? 'Active' : 'Inactive'} 
                          color={gender.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <PermissionGate permission="change" model="config">
                          <IconButton onClick={() => handleEdit(gender)}>
                            <Edit />
                          </IconButton>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Business Rules
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(businessRules).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell>General</TableCell>
                      <TableCell>{key}</TableCell>
                      <TableCell>{key}</TableCell>
                      <TableCell>{String(value)}</TableCell>
                      <TableCell>
                        <Chip 
                          label="Active" 
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <PermissionGate permission="change" model="config">
                          <IconButton onClick={() => handleEdit({ key, value })}>
                            <Edit />
                          </IconButton>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <Dialog open={isDialogOpen} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Configuration' : 'Add Configuration'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Key"
            value={editingItem?.key || ''}
            onChange={(e) => setEditingItem({...editingItem, key: e.target.value})}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Value"
            value={editingItem?.value || ''}
            onChange={(e) => setEditingItem({...editingItem, value: e.target.value})}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Data Type</InputLabel>
            <Select
              value={editingItem?.data_type || 'string'}
              onChange={(e) => setEditingItem({...editingItem, data_type: e.target.value})}
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="integer">Integer</MenuItem>
              <MenuItem value="decimal">Decimal</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Description"
            value={editingItem?.description || ''}
            onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControlLabel
            control={
              <Switch
                checked={editingItem?.is_active ?? true}
                onChange={(e) => setEditingItem({...editingItem, is_active: e.target.checked})}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
