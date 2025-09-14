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

  console.log('ProtectedRoute - isLoading:', isLoading, 'user:', user);

  if (isLoading) {
    console.log('ProtectedRoute - showing loading spinner');
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('ProtectedRoute - no user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (requiredRole && user.user.role.name !== requiredRole) {
    console.log('ProtectedRoute - role check failed, redirecting to unauthorized');
    return <Navigate to="/unauthorized" replace />;
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission, requiredModel)) {
    console.log('ProtectedRoute - permission check failed, redirecting to unauthorized');
    return <Navigate to="/unauthorized" replace />;
  }

  console.log('ProtectedRoute - access granted, rendering children');
  return <>{children}</>;
};