import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { PermissionProvider } from './contexts/PermissionContext';
import { ConfigurationProvider } from './contexts/ConfigurationContext';
import { Layout } from './components/common/Layout';
import { ReservationManagement } from './pages/ReservationManagement';
import { ReservationsExplorer } from './pages/ReservationsExplorer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { GuestManagement } from './pages/GuestManagement';
import ServicesPage from './pages/ServicesPage';
import Housekeeping from './pages/Housekeeping';
import { SpaScheduling } from './pages/SpaScheduling';
import { NewReservation } from './pages/NewReservation';
import { theme } from './theme';

// Lazy load ConfigurationPage to avoid circular dependency
const ConfigurationPage = React.lazy(() => import('./pages/ConfigurationPage').then(module => ({ default: module.ConfigurationPage })));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <PermissionProvider>
          <ConfigurationProvider>
            <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginForm />} />
              
              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard" element={
                <ProtectedRoute requiredPermission="view" requiredModel="dashboard">
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/guests" element={
                <ProtectedRoute requiredPermission="view" requiredModel="guests">
                  <Layout>
                    <GuestManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/reservations" element={
                <ProtectedRoute requiredPermission="view" requiredModel="reservations">
                  <Layout>
                    <ReservationManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/reservations/explore" element={
                <ProtectedRoute requiredPermission="view" requiredModel="reservations">
                  <Layout>
                    <ReservationsExplorer />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/services" element={
                <ProtectedRoute requiredPermission="view" requiredModel="services">
                  <Layout>
                    <ServicesPage />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/analytics" element={
                <ProtectedRoute requiredPermission="view" requiredModel="analytics">
                  <Layout>
                    <div>Analytics - Coming Soon</div>
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/housekeeping" element={
                <ProtectedRoute requiredPermission="view" requiredModel="reservations">
                  <Layout>
                    <Housekeeping />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/config" element={
                <ProtectedRoute requiredPermission="view" requiredModel="config">
                  <Layout>
                    <Suspense fallback={<LoadingSpinner message="Loading configuration..." />}>
                      <ConfigurationPage />
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/spa-scheduling" element={
                <ProtectedRoute requiredPermission="view" requiredModel="reservations">
                  <Layout>
                    <SpaScheduling />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/spa-scheduling/new" element={
                <ProtectedRoute requiredPermission="view" requiredModel="reservations">
                  <Layout>
                    <NewReservation />
                  </Layout>
                </ProtectedRoute>
              } />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Router>
          </ConfigurationProvider>
        </PermissionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;