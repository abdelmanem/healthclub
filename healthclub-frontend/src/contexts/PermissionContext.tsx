import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserPermissions } from '../types/permissions';
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
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPermissions | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      loadUserPermissions();
    } else {
      setIsLoading(false);
    }
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
      authService.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      await authService.login(username, password);
      await loadUserPermissions();
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setPermissions([]);
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
      isLoading,
      login,
      logout
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
