/**
 * Custom hook for discount permissions
 * 
 * Provides role-based access control for discount features:
 * - Check user permissions
 * - Role-based access control
 * - Feature flag management
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface DiscountPermissions {
  canViewDiscounts: boolean;
  canCreateDiscountTypes: boolean;
  canEditDiscountTypes: boolean;
  canDeleteDiscountTypes: boolean;
  canApplyDiscounts: boolean;
  canApproveDiscounts: boolean;
  canViewAnalytics: boolean;
  canExportReports: boolean;
  canManageRules: boolean;
}

export const useDiscountPermissions = (): DiscountPermissions => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<DiscountPermissions>({
    canViewDiscounts: false,
    canCreateDiscountTypes: false,
    canEditDiscountTypes: false,
    canDeleteDiscountTypes: false,
    canApplyDiscounts: false,
    canApproveDiscounts: false,
    canViewAnalytics: false,
    canExportReports: false,
    canManageRules: false,
  });

  useEffect(() => {
    if (!user) {
      setPermissions({
        canViewDiscounts: false,
        canCreateDiscountTypes: false,
        canEditDiscountTypes: false,
        canDeleteDiscountTypes: false,
        canApplyDiscounts: false,
        canApproveDiscounts: false,
        canViewAnalytics: false,
        canExportReports: false,
        canManageRules: false,
      });
      return;
    }

    // Define permissions based on user role
    const userRole = user.role || 'employee';
    
    switch (userRole) {
      case 'admin':
        setPermissions({
          canViewDiscounts: true,
          canCreateDiscountTypes: true,
          canEditDiscountTypes: true,
          canDeleteDiscountTypes: true,
          canApplyDiscounts: true,
          canApproveDiscounts: true,
          canViewAnalytics: true,
          canExportReports: true,
          canManageRules: true,
        });
        break;
        
      case 'manager':
        setPermissions({
          canViewDiscounts: true,
          canCreateDiscountTypes: true,
          canEditDiscountTypes: true,
          canDeleteDiscountTypes: false,
          canApplyDiscounts: true,
          canApproveDiscounts: true,
          canViewAnalytics: true,
          canExportReports: true,
          canManageRules: false,
        });
        break;
        
      case 'supervisor':
        setPermissions({
          canViewDiscounts: true,
          canCreateDiscountTypes: false,
          canEditDiscountTypes: false,
          canDeleteDiscountTypes: false,
          canApplyDiscounts: true,
          canApproveDiscounts: true,
          canViewAnalytics: true,
          canExportReports: false,
          canManageRules: false,
        });
        break;
        
      case 'front_office':
        setPermissions({
          canViewDiscounts: true,
          canCreateDiscountTypes: false,
          canEditDiscountTypes: false,
          canDeleteDiscountTypes: false,
          canApplyDiscounts: true,
          canApproveDiscounts: false,
          canViewAnalytics: false,
          canExportReports: false,
          canManageRules: false,
        });
        break;
        
      case 'employee':
        setPermissions({
          canViewDiscounts: true,
          canCreateDiscountTypes: false,
          canEditDiscountTypes: false,
          canDeleteDiscountTypes: false,
          canApplyDiscounts: true,
          canApproveDiscounts: false,
          canViewAnalytics: false,
          canExportReports: false,
          canManageRules: false,
        });
        break;
        
      default:
        setPermissions({
          canViewDiscounts: false,
          canCreateDiscountTypes: false,
          canEditDiscountTypes: false,
          canDeleteDiscountTypes: false,
          canApplyDiscounts: false,
          canApproveDiscounts: false,
          canViewAnalytics: false,
          canExportReports: false,
          canManageRules: false,
        });
    }
  }, [user]);

  return permissions;
};
