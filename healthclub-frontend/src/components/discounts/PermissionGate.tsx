/**
 * Permission Gate Component
 * 
 * Permission-based component rendering:
 * - Show/hide features based on permissions
 * - Role-based UI elements
 * - Access control messages
 */

import React from 'react';
import { Box, Alert, Typography, Button } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { useDiscountPermissions } from '../../hooks/useDiscountPermissions';

interface PermissionGateProps {
  permission: keyof ReturnType<typeof useDiscountPermissions>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showMessage?: boolean;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallback,
  showMessage = true,
  message,
  actionLabel,
  onAction,
}) => {
  const permissions = useDiscountPermissions();
  const hasPermission = permissions[permission];

  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showMessage) {
    return null;
  }

  const defaultMessage = `You don't have permission to access this feature.`;
  const displayMessage = message || defaultMessage;

  return (
    <Box sx={{ p: 2 }}>
      <Alert 
        severity="warning" 
        icon={<LockIcon />}
        action={
          actionLabel && onAction ? (
            <Button color="inherit" size="small" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : undefined
        }
      >
        <Typography variant="body2">
          {displayMessage}
        </Typography>
      </Alert>
    </Box>
  );
};
