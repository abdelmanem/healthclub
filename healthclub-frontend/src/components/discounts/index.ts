/**
 * Discount Components Export
 * 
 * Central export file for all discount-related components
 */

export { DiscountManagement } from './DiscountManagement';
export { DiscountTypeManager } from './DiscountTypeManager';
export { AppliedDiscountsManager } from './AppliedDiscountsManager';
export { ApprovalWorkflow } from './ApprovalWorkflow';
export { DiscountAnalytics } from './DiscountAnalytics';
export { PermissionGate } from './PermissionGate';

// Re-export hooks
export { useDiscountPermissions } from '../../hooks/useDiscountPermissions';
