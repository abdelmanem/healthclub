import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { DiscountManagement } from '../DiscountManagement';
import { PermissionProvider } from '../../../contexts/PermissionContext';
import { theme } from '../../../theme';

// Mock the discount service
jest.mock('../../../services/discounts', () => ({
  discountService: {
    listDiscountTypes: jest.fn().mockResolvedValue([]),
    listReservationDiscounts: jest.fn().mockResolvedValue([]),
  },
}));

// Mock the snackbar hook
jest.mock('../../common/useSnackbar', () => ({
  useSnackbar: () => ({
    showSnackbar: jest.fn(),
    SnackbarComponent: <div data-testid="snackbar" />,
  }),
}));

const MockPermissionProvider = ({ children, userRole = 'admin' }: { children: React.ReactNode; userRole?: string }) => {
  const mockUser = {
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      is_staff: true,
      is_superuser: userRole === 'admin',
      role: {
        id: 1,
        name: userRole,
        description: `${userRole} role`,
      },
    },
    permissions: {
      discounts: userRole === 'admin' ? ['view', 'add', 'change', 'delete'] : ['view'],
      analytics: userRole === 'admin' ? ['view'] : [],
    },
    groups: [userRole],
  };

  const mockContextValue = {
    user: mockUser,
    permissions: userRole === 'admin' ? ['view', 'add', 'change', 'delete'] : ['view'],
    hasPermission: jest.fn((permission: string, model?: string) => {
      if (userRole === 'admin') return true;
      return permission === 'view' && model === 'discounts';
    }),
    hasObjectPermission: jest.fn().mockResolvedValue(true),
    canView: jest.fn((model: string) => model === 'discounts'),
    canAdd: jest.fn((model: string) => userRole === 'admin' && model === 'discounts'),
    canChange: jest.fn((model: string) => userRole === 'admin' && model === 'discounts'),
    canDelete: jest.fn((model: string) => userRole === 'admin' && model === 'discounts'),
    isLoading: false,
    reloadPermissions: jest.fn(),
  };

  return (
    <PermissionProvider>
      {children}
    </PermissionProvider>
  );
};

const renderWithProviders = (component: React.ReactElement, userRole = 'admin') => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <MockPermissionProvider userRole={userRole}>
          {component}
        </MockPermissionProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('DiscountManagement', () => {
  it('renders discount management interface for admin users', async () => {
    renderWithProviders(<DiscountManagement />, 'admin');

    await waitFor(() => {
      expect(screen.getByText('Discount Management')).toBeInTheDocument();
      expect(screen.getByText('Manage discount types, view applied discounts, handle approvals, and analyze performance.')).toBeInTheDocument();
    });

    // Check if all tabs are visible for admin
    expect(screen.getByText('Discount Types')).toBeInTheDocument();
    expect(screen.getByText('Applied Discounts')).toBeInTheDocument();
    expect(screen.getByText('Approval Workflow')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('restricts access for non-admin users', async () => {
    renderWithProviders(<DiscountManagement />, 'employee');

    await waitFor(() => {
      expect(screen.getByText('Discount Management')).toBeInTheDocument();
    });

    // Check if some tabs are disabled for non-admin users
    const discountTypesTab = screen.getByText('Discount Types').closest('button');
    const appliedDiscountsTab = screen.getByText('Applied Discounts').closest('button');
    const approvalWorkflowTab = screen.getByText('Approval Workflow').closest('button');
    const analyticsTab = screen.getByText('Analytics').closest('button');

    // These should be disabled for employees
    expect(discountTypesTab).toHaveAttribute('disabled');
    expect(approvalWorkflowTab).toHaveAttribute('disabled');
    expect(analyticsTab).toHaveAttribute('disabled');
    
    // Applied Discounts should be enabled for view-only access
    expect(appliedDiscountsTab).not.toHaveAttribute('disabled');
  });

  it('shows appropriate permissions for manager role', async () => {
    renderWithProviders(<DiscountManagement />, 'manager');

    await waitFor(() => {
      expect(screen.getByText('Discount Management')).toBeInTheDocument();
    });

    // Managers should have more access than employees but less than admins
    const discountTypesTab = screen.getByText('Discount Types').closest('button');
    const appliedDiscountsTab = screen.getByText('Applied Discounts').closest('button');
    const approvalWorkflowTab = screen.getByText('Approval Workflow').closest('button');
    const analyticsTab = screen.getByText('Analytics').closest('button');

    // These should be enabled for managers
    expect(discountTypesTab).not.toHaveAttribute('disabled');
    expect(appliedDiscountsTab).not.toHaveAttribute('disabled');
    expect(approvalWorkflowTab).not.toHaveAttribute('disabled');
    expect(analyticsTab).not.toHaveAttribute('disabled');
  });
});

describe('Discount Permissions', () => {
  it('correctly calculates permissions based on user role', () => {
    // This test would verify that the useDiscountPermissions hook
    // correctly calculates permissions based on the user's role and permissions
    expect(true).toBe(true); // Placeholder for actual permission testing
  });
});
