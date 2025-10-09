import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the auth service
jest.mock('./services/auth', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(() => false),
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('Health Club Management')).toBeInTheDocument();
  });
});