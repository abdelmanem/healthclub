/**
 * Custom hook for discount permissions
 * 
 * Provides role-based access control for discount features:
 * - Check user permissions
 * - Role-based access control
 * - Feature flag management
 */

import { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';

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
  const { user, hasPermission } = usePermissions();
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
    const userRole = user.user.role?.name || 'employee';
    
    // Use the existing permission system instead of hardcoded roles
    setPermissions({
      canViewDiscounts: hasPermission('view', 'discounts') || user.user.is_superuser,
      canCreateDiscountTypes: hasPermission('add', 'discounts') || user.user.is_superuser,
      canEditDiscountTypes: hasPermission('change', 'discounts') || user.user.is_superuser,
      canDeleteDiscountTypes: hasPermission('delete', 'discounts') || user.user.is_superuser,
      canApplyDiscounts: hasPermission('add', 'discounts') || user.user.is_superuser,
      canApproveDiscounts: hasPermission('change', 'discounts') || user.user.is_superuser,
      canViewAnalytics: hasPermission('view', 'analytics') || user.user.is_superuser,
      canExportReports: hasPermission('view', 'analytics') || user.user.is_superuser,
      canManageRules: hasPermission('change', 'discounts') || user.user.is_superuser,
    });
  }, [user, hasPermission]);

  return permissions;
};
