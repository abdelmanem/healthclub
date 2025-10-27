import { renderHook } from '@testing-library/react';
import { useDiscountPermissions } from '../useDiscountPermissions';
import { PermissionProvider } from '../../contexts/PermissionContext';
import React from 'react';

// Mock the PermissionContext
const mockHasPermission = jest.fn();
const mockUser = {
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    is_staff: true,
    is_superuser: false,
    role: {
      id: 1,
      name: 'manager',
      description: 'Manager role',
    },
  },
  permissions: {
    discounts: ['view', 'add', 'change'],
    analytics: ['view'],
  },
  groups: ['manager'],
};

const MockPermissionProvider = ({ children, user, hasPermission }: { 
  children: React.ReactNode; 
  user?: any; 
  hasPermission?: jest.Mock;
}) => {
  const contextValue = {
    user: user || null,
    permissions: user ? Object.values(user.permissions).flat() : [],
    hasPermission: hasPermission || mockHasPermission,
    hasObjectPermission: jest.fn().mockResolvedValue(true),
    canView: jest.fn((model: string) => hasPermission?.(model) || false),
    canAdd: jest.fn((model: string) => hasPermission?.(model) || false),
    canChange: jest.fn((model: string) => hasPermission?.(model) || false),
    canDelete: jest.fn((model: string) => hasPermission?.(model) || false),
    isLoading: false,
    reloadPermissions: jest.fn(),
  };

  return (
    <PermissionProvider>
      {children}
    </PermissionProvider>
  );
};

describe('useDiscountPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false permissions when user is null', () => {
    const { result } = renderHook(() => useDiscountPermissions(), {
      wrapper: ({ children }) => (
        <MockPermissionProvider user={null}>
          {children}
        </MockPermissionProvider>
      ),
    });

    expect(result.current.canViewDiscounts).toBe(false);
    expect(result.current.canCreateDiscountTypes).toBe(false);
    expect(result.current.canEditDiscountTypes).toBe(false);
    expect(result.current.canDeleteDiscountTypes).toBe(false);
    expect(result.current.canApplyDiscounts).toBe(false);
    expect(result.current.canApproveDiscounts).toBe(false);
    expect(result.current.canViewAnalytics).toBe(false);
    expect(result.current.canExportReports).toBe(false);
    expect(result.current.canManageRules).toBe(false);
  });

  it('returns correct permissions for superuser', () => {
    const superUser = {
      ...mockUser,
      user: {
        ...mockUser.user,
        is_superuser: true,
      },
    };

    const { result } = renderHook(() => useDiscountPermissions(), {
      wrapper: ({ children }) => (
        <MockPermissionProvider user={superUser}>
          {children}
        </MockPermissionProvider>
      ),
    });

    // Superuser should have all permissions
    expect(result.current.canViewDiscounts).toBe(true);
    expect(result.current.canCreateDiscountTypes).toBe(true);
    expect(result.current.canEditDiscountTypes).toBe(true);
    expect(result.current.canDeleteDiscountTypes).toBe(true);
    expect(result.current.canApplyDiscounts).toBe(true);
    expect(result.current.canApproveDiscounts).toBe(true);
    expect(result.current.canViewAnalytics).toBe(true);
    expect(result.current.canExportReports).toBe(true);
    expect(result.current.canManageRules).toBe(true);
  });

  it('returns correct permissions based on hasPermission function', () => {
    const mockHasPermission = jest.fn()
      .mockReturnValueOnce(true)  // view discounts
      .mockReturnValueOnce(false) // add discounts
      .mockReturnValueOnce(true)  // change discounts
      .mockReturnValueOnce(false) // delete discounts
      .mockReturnValueOnce(false) // add discounts (for apply)
      .mockReturnValueOnce(true)  // change discounts (for approve)
      .mockReturnValueOnce(true)  // view analytics
      .mockReturnValueOnce(true)  // view analytics (for export)
      .mockReturnValueOnce(true); // change discounts (for manage rules)

    const { result } = renderHook(() => useDiscountPermissions(), {
      wrapper: ({ children }) => (
        <MockPermissionProvider user={mockUser} hasPermission={mockHasPermission}>
          {children}
        </MockPermissionProvider>
      ),
    });

    expect(result.current.canViewDiscounts).toBe(true);
    expect(result.current.canCreateDiscountTypes).toBe(false);
    expect(result.current.canEditDiscountTypes).toBe(true);
    expect(result.current.canDeleteDiscountTypes).toBe(false);
    expect(result.current.canApplyDiscounts).toBe(false);
    expect(result.current.canApproveDiscounts).toBe(true);
    expect(result.current.canViewAnalytics).toBe(true);
    expect(result.current.canExportReports).toBe(true);
    expect(result.current.canManageRules).toBe(true);
  });

  it('handles different user roles correctly', () => {
    const employeeUser = {
      ...mockUser,
      user: {
        ...mockUser.user,
        role: {
          id: 2,
          name: 'employee',
          description: 'Employee role',
        },
      },
    };

    const mockHasPermission = jest.fn()
      .mockImplementation((permission: string, model?: string) => {
        if (model === 'discounts' && permission === 'view') return true;
        if (model === 'analytics' && permission === 'view') return false;
        return false;
      });

    const { result } = renderHook(() => useDiscountPermissions(), {
      wrapper: ({ children }) => (
        <MockPermissionProvider user={employeeUser} hasPermission={mockHasPermission}>
          {children}
        </MockPermissionProvider>
      ),
    });

    expect(result.current.canViewDiscounts).toBe(true);
    expect(result.current.canCreateDiscountTypes).toBe(false);
    expect(result.current.canEditDiscountTypes).toBe(false);
    expect(result.current.canDeleteDiscountTypes).toBe(false);
    expect(result.current.canApplyDiscounts).toBe(false);
    expect(result.current.canApproveDiscounts).toBe(false);
    expect(result.current.canViewAnalytics).toBe(false);
    expect(result.current.canExportReports).toBe(false);
    expect(result.current.canManageRules).toBe(false);
  });
});
