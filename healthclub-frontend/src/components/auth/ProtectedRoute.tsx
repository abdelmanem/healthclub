import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { CircularProgress, Box } from '@mui/material';

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
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
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
