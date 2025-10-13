# Frontend Permission System & Configuration Management

## 🔐 **Frontend Permission System**

### **1. Permission Types & Roles**

#### **Backend Permission Structure:**
- **Object-Level Permissions**: Using django-guardian
- **Model Permissions**: view, add, change, delete
- **User Roles**: Admin, Manager, Front Office, Employee
- **Permission Categories**: reservations, guests, services, employees, invoices

#### **Frontend Permission Implementation:**

```typescript
// src/types/permissions.ts
export interface UserPermissions {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_superuser: boolean;
    role: {
      id: number;
      name: string;
      description: string;
    };
  };
  permissions: {
    [key: string]: string[]; // model_name: [permission_codes]
  };
  groups: string[];
}

export interface Permission {
  codename: string;
  name: string;
  app_label: string;
  model: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}
```

### **2. Permission Context & Hooks**

```typescript
// src/contexts/PermissionContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserPermissions, Permission } from '../types/permissions';
import { authService } from '../services/auth';

interface PermissionContextType {
  user: UserPermissions | null;
  permissions: string[];
  hasPermission: (permission: string, model?: string) => boolean;
  hasObjectPermission: (permission: string, model: string, objectId: number) => Promise<boolean>;
  canView: (model: string) => boolean;
  canAdd: (model: string) => boolean;
  canChange: (model: string) => boolean;
  canDelete: (model: string) => boolean;
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPermissions | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      
      // Extract all permissions
      const allPermissions: string[] = [];
      Object.values(userData.permissions).forEach(modelPermissions => {
        allPermissions.push(...modelPermissions);
      });
      setPermissions(allPermissions);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string, model?: string): boolean => {
    if (!user) return false;
    if (user.user.is_superuser) return true;
    
    if (model) {
      return user.permissions[model]?.includes(permission) || false;
    }
    
    return permissions.includes(permission);
  };

  const hasObjectPermission = async (permission: string, model: string, objectId: number): Promise<boolean> => {
    if (!user) return false;
    if (user.user.is_superuser) return true;
    
    try {
      const response = await fetch(`/api/${model}/${objectId}/permissions/`);
      const data = await response.json();
      return data[user.user.username]?.includes(permission) || false;
    } catch (error) {
      console.error('Failed to check object permission:', error);
      return false;
    }
  };

  const canView = (model: string): boolean => hasPermission('view', model);
  const canAdd = (model: string): boolean => hasPermission('add', model);
  const canChange = (model: string): boolean => hasPermission('change', model);
  const canDelete = (model: string): boolean => hasPermission('delete', model);

  return (
    <PermissionContext.Provider value={{
      user,
      permissions,
      hasPermission,
      hasObjectPermission,
      canView,
      canAdd,
      canChange,
      canDelete,
      isLoading
    }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};
```

### **3. Permission-Based Components**

```typescript
// src/components/common/PermissionGate.tsx
import React from 'react';
import { usePermissions } from '../../contexts/PermissionContext';

interface PermissionGateProps {
  permission: string;
  model?: string;
  objectId?: number;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  model,
  objectId,
  fallback = null,
  children
}) => {
  const { hasPermission, hasObjectPermission, user } = usePermissions();
  const [hasObjectPerm, setHasObjectPerm] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (objectId && model) {
      hasObjectPermission(permission, model, objectId).then(setHasObjectPerm);
    }
  }, [objectId, model, permission, hasObjectPermission]);

  // Check general permission
  if (!hasPermission(permission, model)) {
    return <>{fallback}</>;
  }

  // Check object-specific permission if needed
  if (objectId && model && hasObjectPerm === false) {
    return <>{fallback}</>;
  }

  // Still loading object permission
  if (objectId && model && hasObjectPerm === null) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Usage examples:
// <PermissionGate permission="view" model="reservations">
//   <ReservationList />
// </PermissionGate>

// <PermissionGate permission="change" model="reservations" objectId={123}>
//   <EditReservationButton />
// </PermissionGate>
```

### **4. Role-Based Route Protection**

```typescript
// src/components/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredModel?: string;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredModel,
  requiredRole
}) => {
  const { user, hasPermission, isLoading } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (requiredRole && user.user.role.name !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission, requiredModel)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// Usage in routing:
// <Route path="/reservations" element={
//   <ProtectedRoute requiredPermission="view" requiredModel="reservations">
//     <ReservationPage />
//   </ProtectedRoute>
// } />
```

## ⚙️ **Configuration Management System**

### **1. Configuration Types**

```typescript
// src/types/config.ts
export interface SystemConfiguration {
  id: number;
  key: string;
  value: string;
  description: string;
  data_type: 'string' | 'integer' | 'decimal' | 'boolean' | 'json';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembershipTier {
  id: number;
  name: string;
  display_name: string;
  description: string;
  discount_percentage: number;
  priority_booking: boolean;
  free_services_count: number;
  min_spend_required: number;
  points_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

export interface GenderOption {
  id: number;
  code: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface BusinessRule {
  id: number;
  category: 'booking' | 'cancellation' | 'payment' | 'loyalty' | 'inventory' | 'employee';
  name: string;
  description: string;
  key: string;
  value: string;
  data_type: 'string' | 'integer' | 'decimal' | 'boolean' | 'json';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### **2. Configuration Service**

```typescript
// src/services/config.ts
import { api } from './api';
import { SystemConfiguration, MembershipTier, GenderOption, BusinessRule } from '../types/config';

export const configService = {
  // System Configuration
  getSystemConfigs: async (): Promise<SystemConfiguration[]> => {
    const response = await api.get('/config/system-configurations/');
    return response.data;
  },

  updateSystemConfig: async (id: number, data: Partial<SystemConfiguration>): Promise<SystemConfiguration> => {
    const response = await api.patch(`/config/system-configurations/${id}/`, data);
    return response.data;
  },

  createSystemConfig: async (data: Omit<SystemConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<SystemConfiguration> => {
    const response = await api.post('/config/system-configurations/', data);
    return response.data;
  },

  // Membership Tiers
  getMembershipTiers: async (): Promise<MembershipTier[]> => {
    const response = await api.get('/config/membership-tiers/');
    return response.data;
  },

  updateMembershipTier: async (id: number, data: Partial<MembershipTier>): Promise<MembershipTier> => {
    const response = await api.patch(`/config/membership-tiers/${id}/`, data);
    return response.data;
  },

  createMembershipTier: async (data: Omit<MembershipTier, 'id'>): Promise<MembershipTier> => {
    const response = await api.post('/config/membership-tiers/', data);
    return response.data;
  },

  // Gender Options
  getGenderOptions: async (): Promise<GenderOption[]> => {
    const response = await api.get('/config/gender-options/');
    return response.data;
  },

  updateGenderOption: async (id: number, data: Partial<GenderOption>): Promise<GenderOption> => {
    const response = await api.patch(`/config/gender-options/${id}/`, data);
    return response.data;
  },

  // Business Rules
  getBusinessRules: async (): Promise<BusinessRule[]> => {
    const response = await api.get('/config/business-rules/');
    return response.data;
  },

  updateBusinessRule: async (id: number, data: Partial<BusinessRule>): Promise<BusinessRule> => {
    const response = await api.patch(`/config/business-rules/${id}/`, data);
    return response.data;
  },

  createBusinessRule: async (data: Omit<BusinessRule, 'id' | 'created_at' | 'updated_at'>): Promise<BusinessRule> => {
    const response = await api.post('/config/business-rules/', data);
    return response.data;
  },

  // Utility functions
  getConfigValue: async (key: string, defaultValue?: any): Promise<any> => {
    try {
      const configs = await configService.getSystemConfigs();
      const config = configs.find(c => c.key === key && c.is_active);
      if (config) {
        // Type conversion based on data_type
        switch (config.data_type) {
          case 'integer':
            return parseInt(config.value);
          case 'decimal':
            return parseFloat(config.value);
          case 'boolean':
            return config.value.toLowerCase() === 'true';
          case 'json':
            return JSON.parse(config.value);
          default:
            return config.value;
        }
      }
      return defaultValue;
    } catch (error) {
      console.error('Failed to get config value:', error);
      return defaultValue;
    }
  }
};
```

### **3. Configuration Management Components**

```typescript
// src/components/admin/ConfigurationManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
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
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip
} from '@mui/material';
import { Edit, Add, Delete, Save, Cancel } from '@mui/icons-material';
import { configService } from '../../services/config';
import { SystemConfiguration, MembershipTier, GenderOption, BusinessRule } from '../../types/config';

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
  const [systemConfigs, setSystemConfigs] = useState<SystemConfiguration[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<MembershipTier[]>([]);
  const [genderOptions, setGenderOptions] = useState<GenderOption[]>([]);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllConfigurations();
  }, []);

  const loadAllConfigurations = async () => {
    try {
      const [configs, tiers, genders, rules] = await Promise.all([
        configService.getSystemConfigs(),
        configService.getMembershipTiers(),
        configService.getGenderOptions(),
        configService.getBusinessRules()
      ]);
      
      setSystemConfigs(configs);
      setMembershipTiers(tiers);
      setGenderOptions(genders);
      setBusinessRules(rules);
    } catch (error) {
      console.error('Failed to load configurations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        // Update existing
        const updatedItem = await configService.updateSystemConfig(editingItem.id, editingItem);
        setSystemConfigs(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      } else {
        // Create new
        const newItem = await configService.createSystemConfig(editingItem);
        setSystemConfigs(prev => [...prev, newItem]);
      }
      setIsDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  if (isLoading) {
    return <Typography>Loading configurations...</Typography>;
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
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAdd}
              >
                Add Configuration
              </Button>
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
                  {systemConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>{config.key}</TableCell>
                      <TableCell>{config.value}</TableCell>
                      <TableCell>
                        <Chip label={config.data_type} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={config.is_active ? 'Active' : 'Inactive'} 
                          color={config.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleEdit(config)}>
                          <Edit />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Similar TabPanels for other configuration types */}

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
```

### **4. Dynamic Choice Loading**

```typescript
// src/hooks/useDynamicChoices.ts
import { useState, useEffect } from 'react';
import { configService } from '../services/config';

export const useDynamicChoices = (choiceType: 'membership_tiers' | 'gender_options' | 'business_rules') => {
  const [choices, setChoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChoices();
  }, [choiceType]);

  const loadChoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let data: any[] = [];
      switch (choiceType) {
        case 'membership_tiers':
          data = await configService.getMembershipTiers();
          break;
        case 'gender_options':
          data = await configService.getGenderOptions();
          break;
        case 'business_rules':
          data = await configService.getBusinessRules();
          break;
      }
      
      setChoices(data.filter(item => item.is_active));
    } catch (err) {
      setError('Failed to load choices');
      console.error('Error loading choices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { choices, isLoading, error, refetch: loadChoices };
};

// Usage in components:
// const { choices: membershipTiers, isLoading } = useDynamicChoices('membership_tiers');
```

### **5. Configuration Context**

```typescript
// src/contexts/ConfigurationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { configService } from '../services/config';

interface ConfigurationContextType {
  systemConfigs: { [key: string]: any };
  membershipTiers: any[];
  genderOptions: any[];
  businessRules: { [key: string]: any };
  isLoading: boolean;
  getConfigValue: (key: string, defaultValue?: any) => any;
  refreshConfigurations: () => Promise<void>;
}

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemConfigs, setSystemConfigs] = useState<{ [key: string]: any }>({});
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);
  const [genderOptions, setGenderOptions] = useState<any[]>([]);
  const [businessRules, setBusinessRules] = useState<{ [key: string]: any }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllConfigurations();
  }, []);

  const loadAllConfigurations = async () => {
    try {
      const [configs, tiers, genders, rules] = await Promise.all([
        configService.getSystemConfigs(),
        configService.getMembershipTiers(),
        configService.getGenderOptions(),
        configService.getBusinessRules()
      ]);

      // Convert configs to key-value object
      const configObj: { [key: string]: any } = {};
      configs.forEach(config => {
        if (config.is_active) {
          configObj[config.key] = config.value;
        }
      });

      // Convert business rules to key-value object
      const rulesObj: { [key: string]: any } = {};
      rules.forEach(rule => {
        if (rule.is_active) {
          rulesObj[rule.key] = rule.value;
        }
      });

      setSystemConfigs(configObj);
      setMembershipTiers(tiers.filter(tier => tier.is_active));
      setGenderOptions(genders.filter(gender => gender.is_active));
      setBusinessRules(rulesObj);
    } catch (error) {
      console.error('Failed to load configurations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConfigValue = (key: string, defaultValue?: any): any => {
    return systemConfigs[key] || defaultValue;
  };

  const refreshConfigurations = async () => {
    await loadAllConfigurations();
  };

  return (
    <ConfigurationContext.Provider value={{
      systemConfigs,
      membershipTiers,
      genderOptions,
      businessRules,
      isLoading,
      getConfigValue,
      refreshConfigurations
    }}>
      {children}
    </ConfigurationContext.Provider>
  );
};

export const useConfiguration = (): ConfigurationContextType => {
  const context = useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};
```

## 🎯 **Implementation Priority**

### **Phase 1: Core Permission System**
1. ✅ Set up PermissionContext and hooks
2. ✅ Create PermissionGate component
3. ✅ Implement ProtectedRoute with role/permission checks
4. ✅ Add permission checks to all major components

### **Phase 2: Configuration Management**
1. ✅ Create configuration service and types
2. ✅ Build ConfigurationManager component
3. ✅ Implement dynamic choice loading
4. ✅ Add configuration context provider

### **Phase 3: Integration**
1. ✅ Replace hardcoded values with dynamic choices
2. ✅ Add permission checks to configuration management
3. ✅ Implement real-time configuration updates
4. ✅ Add configuration validation and error handling

This comprehensive system will provide both robust frontend permissions and flexible configuration management, allowing administrators to manage all system settings through the frontend interface! 🚀
