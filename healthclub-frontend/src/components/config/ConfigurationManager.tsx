import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Button,
  Fade,
  Container,
  Paper,
  Grid,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  Edit,
  Add,
  Save,
  Cancel,
  Delete,
  ContentCopy,
  History,
  Refresh,
  Download,
  Upload,
  FilterList,
  Search,
  MoreVert,
  Settings,
  People,
  Category,
  Business,
  AttachMoney,
  School,
  Inventory,
  Notifications,
  Cancel as CancelIcon,
  CheckCircle,
  Error,
  Warning,
  Info
} from '@mui/icons-material';
import { Schedule } from '@mui/icons-material';
import { TextField, FormControlLabel, Checkbox } from '@mui/material';
import { api } from '../../services/api';
import { useConfiguration } from '../../contexts/ConfigurationContext';
import { PermissionGate } from '../common/PermissionGate';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CancellationReasonForm } from './CancellationReasonForm';
import { CancellationReason } from '../../types/config';
import { EnhancedTable, TableColumn, TableAction } from '../common/EnhancedTable';
import { EnhancedDialog } from '../common/EnhancedDialog';
import { ConfigurationForm } from './ConfigurationForm';
import { useToast } from '../common/ToastProvider';

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
  const [editingCancellationReason, setEditingCancellationReason] = useState<CancellationReason | null>(null);
  const [isCancellationReasonFormOpen, setIsCancellationReasonFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [shiftConfigurations, setShiftConfigurations] = useState<any[]>([]);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  const { 
    systemConfigs, 
    membershipTiers, 
    genderOptions, 
    businessRules,
    commissionTypes,
    trainingTypes,
    productTypes,
    notificationTemplates,
    cancellationReasons,
    isLoading,
    refreshConfigurations
  } = useConfiguration();

  // Tab configurations with icons and colors
  const tabConfigs = [
    { label: 'System Settings', icon: <Settings />, color: 'primary' },
    { label: 'Membership Tiers', icon: <People />, color: 'secondary' },
    { label: 'Gender Options', icon: <Category />, color: 'info' },
    { label: 'Business Rules', icon: <Business />, color: 'warning' },
    { label: 'Commission Types', icon: <AttachMoney />, color: 'success' },
    { label: 'Training Types', icon: <School />, color: 'primary' },
    { label: 'Product Types', icon: <Inventory />, color: 'secondary' },
    { label: 'Notification Templates', icon: <Notifications />, color: 'info' },
    { label: 'Shift Configurations', icon: <Schedule />, color: 'primary' },
    { label: 'Cancellation Reasons', icon: <CancelIcon />, color: 'error' }
  ];

  const SHIFT_TAB_INDEX = 8; // after adding, shift tab sits at index 8

  const handleEdit = (item: any, tabIndex?: number) => {
    if (tabIndex === SHIFT_TAB_INDEX) {
      setEditingShift(item);
      setIsDialogOpen(true);
    } else if (tabIndex === 9) {
      // Handle cancellation reason edit
      setEditingCancellationReason(item as CancellationReason);
      setIsCancellationReasonFormOpen(true);
    } else {
      // Handle other configuration types
      setEditingItem(item);
      setIsDialogOpen(true);
    }
  };

  const handleAdd = (tabIndex?: number) => {
    if (tabIndex === SHIFT_TAB_INDEX) {
      setEditingShift({
        name: '',
        start_time: '09:00',
        end_time: '17:00',
        lunch_start_time: '12:00',
        lunch_end_time: '12:30',
        is_active: true,
        is_default: false
      });
      setIsDialogOpen(true);
    } else if (tabIndex === 9) {
      // Handle cancellation reason add
      setEditingCancellationReason(null);
      setIsCancellationReasonFormOpen(true);
    } else {
      // Handle other configuration types
      setEditingItem(null);
      setIsDialogOpen(true);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Shift configurations save
      if (tabValue === SHIFT_TAB_INDEX && editingShift) {
        if (editingShift.id) {
          await api.patch(`/shift-configurations/${editingShift.id}/`, editingShift);
        } else {
          await api.post('/shift-configurations/', editingShift);
        }
        showSuccess('Shift configuration saved successfully!');
        setIsDialogOpen(false);
        setEditingShift(null);
        await loadShiftConfigurations();
        return;
      }

      // Other types (placeholder)
      console.log('Save configuration:', editingItem);
      await new Promise(resolve => setTimeout(resolve, 1000));
      showSuccess('Configuration saved successfully!');
      setIsDialogOpen(false);
      setEditingItem(null);
      await refreshConfigurations();
    } catch (error) {
      showError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (item: any) => {
    try {
      if (tabValue === SHIFT_TAB_INDEX) {
        if (item?.id) {
          await api.delete(`/shift-configurations/${item.id}/`);
          showSuccess('Shift configuration deleted successfully!');
          await loadShiftConfigurations();
        }
        return;
      }
      // Other types (placeholder)
      console.log('Delete configuration:', item);
      showSuccess('Configuration deleted successfully!');
      await refreshConfigurations();
    } catch (error) {
      showError('Failed to delete configuration');
    }
  };

  const handleDuplicate = (item: any) => {
    const duplicatedItem = { ...item, id: undefined, name: `${item.name} (Copy)` };
    if (tabValue === SHIFT_TAB_INDEX) {
      setEditingShift(duplicatedItem);
      setIsDialogOpen(true);
    } else {
      setEditingItem(duplicatedItem);
      setIsDialogOpen(true);
    }
  };

  const handleBulkDelete = async (items: any[]) => {
    try {
      if (tabValue === SHIFT_TAB_INDEX) {
        const ids = items.map(i => i.id).filter(Boolean);
        await Promise.all(ids.map((id: number) => api.delete(`/shift-configurations/${id}/`)));
        showSuccess(`${ids.length} shift configurations deleted successfully!`);
        await loadShiftConfigurations();
      } else {
        console.log('Bulk delete configurations:', items);
        showSuccess(`${items.length} configurations deleted successfully!`);
        await refreshConfigurations();
      }
    } catch (error) {
      showError('Failed to delete configurations');
    }
  };

  const handleExport = () => {
    showInfo('Export functionality will be implemented soon');
  };

  const handleImport = () => {
    showInfo('Import functionality will be implemented soon');
  };

  const loadShiftConfigurations = async () => {
    try {
      const res = await api.get('/shift-configurations/');
      setShiftConfigurations(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setShiftConfigurations([]);
    }
  };

  useEffect(() => {
    loadShiftConfigurations();
  }, []);

  // Table column configurations
  const getColumnsForTab = (tabIndex: number): TableColumn[] => {
    switch (tabIndex) {
      case 0: // System Settings
        return [
          { id: 'key', label: 'Key', minWidth: 150, sortable: true },
          { id: 'value', label: 'Value', minWidth: 200, sortable: true },
          { id: 'type', label: 'Type', minWidth: 100, format: () => <Chip label="string" size="small" color="primary" /> },
          { id: 'status', label: 'Status', minWidth: 100, format: () => <Chip label="Active" size="small" color="success" /> }
        ];
      case 1: // Membership Tiers
        return [
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'display_name', label: 'Display Name', minWidth: 150, sortable: true },
          { id: 'discount_percentage', label: 'Discount', minWidth: 100, format: (value) => <Chip label={`${value}%`} size="small" color="success" /> },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 2: // Gender Options
        return [
          { id: 'code', label: 'Code', minWidth: 100, sortable: true },
          { id: 'display_name', label: 'Display Name', minWidth: 150, sortable: true },
          { id: 'description', label: 'Description', minWidth: 200 },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 3: // Business Rules
        return [
          { id: 'category', label: 'Category', minWidth: 120, format: () => 'General' },
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'key', label: 'Key', minWidth: 150, sortable: true },
          { id: 'value', label: 'Value', minWidth: 200, sortable: true },
          { id: 'status', label: 'Status', minWidth: 100, format: () => <Chip label="Active" size="small" color="success" /> }
        ];
      case 4: // Commission Types
        return [
          { id: 'code', label: 'Code', minWidth: 100, sortable: true },
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'description', label: 'Description', minWidth: 200 },
          { id: 'percentage', label: 'Percentage', minWidth: 100, format: (value) => value ? <Chip label={`${value}%`} size="small" color="info" /> : '-' },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 5: // Training Types
        return [
          { id: 'code', label: 'Code', minWidth: 100, sortable: true },
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'description', label: 'Description', minWidth: 200 },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 6: // Product Types
        return [
          { id: 'code', label: 'Code', minWidth: 100, sortable: true },
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'description', label: 'Description', minWidth: 200 },
          { id: 'category', label: 'Category', minWidth: 120, sortable: true },
          { id: 'requires_tracking', label: 'Requires Tracking', minWidth: 140, format: (value) => <Chip label={value ? 'Yes' : 'No'} size="small" color={value ? 'warning' : 'default'} /> },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 7: // Notification Templates
        return [
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'template_type', label: 'Type', minWidth: 120, sortable: true },
          { id: 'subject', label: 'Subject', minWidth: 200 },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      case 8: // Shift Configurations
        return [
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'start_time', label: 'Start', minWidth: 100 },
          { id: 'end_time', label: 'End', minWidth: 100 },
          { id: 'lunch_start_time', label: 'Lunch Start', minWidth: 110 },
          { id: 'lunch_end_time', label: 'Lunch End', minWidth: 110 },
          { id: 'is_default', label: 'Default', minWidth: 100, format: (v) => <Chip label={v ? 'Default' : '-'} size="small" color={v ? 'primary' : 'default'} /> },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (v) => <Chip label={v ? 'Active' : 'Inactive'} size="small" color={v ? 'success' : 'default'} /> }
        ];
      case 9: // Cancellation Reasons
        return [
          { id: 'code', label: 'Code', minWidth: 100, sortable: true },
          { id: 'name', label: 'Name', minWidth: 150, sortable: true },
          { id: 'description', label: 'Description', minWidth: 200 },
          { id: 'is_active', label: 'Status', minWidth: 100, format: (value) => <Chip label={value ? 'Active' : 'Inactive'} size="small" color={value ? 'success' : 'default'} /> }
        ];
      default:
        return [];
    }
  };

  // Get data for current tab
  const getDataForTab = (tabIndex: number): any[] => {
    switch (tabIndex) {
      case 0: return Object.entries(systemConfigs).map(([key, value]) => ({ key, value }));
      case 1: return membershipTiers;
      case 2: return genderOptions;
      case 3: return Object.entries(businessRules).map(([key, value]) => ({ key, value, name: key }));
      case 4: return commissionTypes;
      case 5: return trainingTypes;
      case 6: return productTypes;
      case 7: return notificationTemplates;
      case 8: return shiftConfigurations;
      case 9: return cancellationReasons;
      default: return [];
    }
  };

  // Table actions
  const getActionsForTab = (tabIndex: number): TableAction[] => {
    const baseActions: TableAction[] = [
      {
        id: 'edit',
        label: 'Edit',
        icon: <Edit />,
        onClick: (row) => handleEdit(row, tabIndex)
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: <ContentCopy />,
        onClick: (row) => handleDuplicate(row)
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Delete />,
        onClick: (row) => handleDelete(row),
        color: 'error'
      }
    ];

    return baseActions;
  };

  const bulkActions: TableAction[] = [
    {
      id: 'bulk-delete',
      label: 'Delete Selected',
      icon: <Delete />,
      onClick: handleBulkDelete,
      color: 'error'
    }
  ];

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 2,
        color: 'white'
      }}>
        <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
        <Typography variant="h6">Loading configurations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      p: 2
    }}>
      <Container maxWidth="xl">
        {/* Header removed per request */}

        {/* Enhanced Tabs */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
          <Box sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
          }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  color: 'white',
                  fontWeight: 600,
                  minHeight: 64,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                },
                '& .Mui-selected': {
                  color: 'white !important',
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                },
                '& .MuiTabs-indicator': {
                  bgcolor: 'white',
                  height: 3
                }
              }}
            >
              {tabConfigs.map((config, index) => (
                <Tab
                  key={index}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {config.icon}
                      {config.label}
                    </Box>
                  }
                />
              ))}
        </Tabs>
      </Box>

          {/* Tab Content */}
          <Box sx={{ p: 3 }}>
            {/* Header with Add Button */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 3,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: `${tabConfigs[tabValue].color}.main` }}>
                  {tabConfigs[tabValue].icon}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {tabConfigs[tabValue].label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage {tabConfigs[tabValue].label.toLowerCase()} settings
                  </Typography>
                </Box>
              </Box>
              
              <PermissionGate permission="add" model="config">
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleAdd(tabValue)}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    background: `linear-gradient(45deg, ${tabConfigs[tabValue].color}.main 30%, ${tabConfigs[tabValue].color}.dark 90%)`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Add {tabConfigs[tabValue].label.slice(0, -1)}
                </Button>
              </PermissionGate>
            </Box>
            
            {/* Enhanced Table */}
            <EnhancedTable
              columns={getColumnsForTab(tabValue)}
              data={getDataForTab(tabValue)}
              actions={getActionsForTab(tabValue)}
              bulkActions={bulkActions}
              onRefresh={refreshConfigurations}
              onExport={handleExport}
              onImport={handleImport}
              loading={isLoading}
              emptyMessage={`No ${tabConfigs[tabValue].label.toLowerCase()} found`}
              searchPlaceholder={`Search ${tabConfigs[tabValue].label.toLowerCase()}...`}
            />
          </Box>
        </Paper>

        {/* Enhanced Dialog for Configuration Editing */}
        <EnhancedDialog
          open={isDialogOpen}
          onClose={handleCancel}
          onSave={handleSave}
          title={tabValue === SHIFT_TAB_INDEX ? (editingShift?.id ? 'Edit Shift Configuration' : 'Add Shift Configuration') : (editingItem ? 'Edit Configuration' : 'Add Configuration')}
          subtitle={`${tabConfigs[tabValue].label} Management`}
          icon={tabConfigs[tabValue].icon}
          loading={loading}
          stickyHeader
          stickyFooter
        >
          {tabValue === SHIFT_TAB_INDEX ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Shift Name"
                value={editingShift?.name || ''}
                onChange={(e) => setEditingShift((prev: any) => ({ ...prev, name: e.target.value }))}
                size="small"
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Time"
                  type="time"
                  value={editingShift?.start_time || '09:00'}
                  onChange={(e) => setEditingShift((prev: any) => ({ ...prev, start_time: e.target.value }))}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Time"
                  type="time"
                  value={editingShift?.end_time || '17:00'}
                  onChange={(e) => setEditingShift((prev: any) => ({ ...prev, end_time: e.target.value }))}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Lunch Start"
                  type="time"
                  value={editingShift?.lunch_start_time || '12:00'}
                  onChange={(e) => setEditingShift((prev: any) => ({ ...prev, lunch_start_time: e.target.value }))}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Lunch End"
                  type="time"
                  value={editingShift?.lunch_end_time || '12:30'}
                  onChange={(e) => setEditingShift((prev: any) => ({ ...prev, lunch_end_time: e.target.value }))}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={!!editingShift?.is_active} onChange={(e) => setEditingShift((prev: any) => ({ ...prev, is_active: e.target.checked }))} />}
                  label="Active"
                />
                <FormControlLabel
                  control={<Checkbox checked={!!editingShift?.is_default} onChange={(e) => setEditingShift((prev: any) => ({ ...prev, is_default: e.target.checked }))} />}
                  label="Default"
                />
              </Box>
            </Box>
          ) : (
            <ConfigurationForm
              data={editingItem}
              onChange={setEditingItem}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={editingItem?.id ? () => handleDelete(editingItem) : undefined}
              onDuplicate={editingItem ? () => handleDuplicate(editingItem) : undefined}
              loading={loading}
              variant="dialog"
            />
          )}
        </EnhancedDialog>
        
        {/* Cancellation Reason Form Dialog */}
        <CancellationReasonForm
          open={isCancellationReasonFormOpen}
          onClose={() => setIsCancellationReasonFormOpen(false)}
          editingReason={editingCancellationReason}
        />
      </Container>
    </Box>
  );
};
