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