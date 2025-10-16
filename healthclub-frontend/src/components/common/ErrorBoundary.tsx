import React from 'react';
import { Alert, Button, Box, Typography, Paper } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined 
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Alert 
              severity="error"
              icon={<ErrorOutline fontSize="large" />}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={this.handleReset}
                  startIcon={<Refresh />}
                >
                  Try Again
                </Button>
              }
            >
              <Typography variant="h6" gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body2" paragraph>
                {this.state.error?.message || 'An unexpected error occurred'}
              </Typography>
              
              {/* Show stack trace in development */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Box 
                  sx={{ 
                    mt: 2, 
                    p: 2, 
                    bgcolor: 'grey.100', 
                    borderRadius: 1, 
                    fontSize: '0.75rem',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" display="block" mb={1}>
                    Component Stack:
                  </Typography>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </Box>
              )}
            </Alert>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}