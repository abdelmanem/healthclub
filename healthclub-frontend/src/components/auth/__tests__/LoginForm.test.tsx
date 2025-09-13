import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import { PermissionProvider } from '../contexts/PermissionContext';
import { LoginForm } from './LoginForm';

// Mock the auth service
jest.mock('../services/auth', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(),
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <BrowserRouter>
      <PermissionProvider>
        {children}
      </PermissionProvider>
    </BrowserRouter>
  </ThemeProvider>
);

describe('LoginForm', () => {
  it('renders login form', () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    expect(screen.getByText('Health Club Management')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('shows error message on login failure', async () => {
    const { authService } = require('../services/auth');
    authService.login.mockRejectedValueOnce({
      response: { data: { detail: 'Invalid credentials' } }
    });

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpassword' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
