import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Snackbar,
  Alert,
  AlertColor,
  Slide,
  SlideProps,
  Box,
  IconButton,
  Typography
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Warning from '@mui/icons-material/Warning';
import Info from '@mui/icons-material/Info';

interface Toast {
  id: string;
  message: string;
  type: AlertColor;
  duration?: number;
  action?: ReactNode;
  title?: string;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  showSuccess: (message: string, options?: Partial<Toast>) => void;
  showError: (message: string, options?: Partial<Toast>) => void;
  showWarning: (message: string, options?: Partial<Toast>) => void;
  showInfo: (message: string, options?: Partial<Toast>) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

const getIcon = (type: AlertColor) => {
  switch (type) {
    case 'success':
      return <CheckCircle />;
    case 'error':
      return <ErrorIcon />;
    case 'warning':
      return <Warning />;
    case 'info':
    default:
      return <Info />;
  }
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 6000,
      ...toast,
    };
    
    setToasts(prev => [...prev, newToast]);

    // Auto-hide after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }
  }, []);

  const showSuccess = useCallback((message: string, options: Partial<Toast> = {}) => {
    showToast({ message, type: 'success', ...options });
  }, [showToast]);

  const showError = useCallback((message: string, options: Partial<Toast> = {}) => {
    showToast({ message, type: 'error', duration: 8000, ...options });
  }, [showToast]);

  const showWarning = useCallback((message: string, options: Partial<Toast> = {}) => {
    showToast({ message, type: 'warning', ...options });
  }, [showToast]);

  const showInfo = useCallback((message: string, options: Partial<Toast> = {}) => {
    showToast({ message, type: 'info', ...options });
  }, [showToast]);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const contextValue: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <Box
        sx={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxWidth: 400,
          width: '100%'
        }}
      >
        {toasts.map((toast, index) => (
          <Snackbar
            key={toast.id}
            open={true}
            TransitionComponent={SlideTransition}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ 
              position: 'static',
              transform: 'none',
              '& .MuiSnackbarContent-root': {
                transform: 'none'
              }
            }}
          >
            <Alert
              severity={toast.type}
              onClose={() => hideToast(toast.id)}
              icon={getIcon(toast.type)}
              sx={{
                width: '100%',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: 2,
                '& .MuiAlert-message': {
                  width: '100%'
                }
              }}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {toast.action}
                  <IconButton
                    size="small"
                    onClick={() => hideToast(toast.id)}
                    sx={{ color: 'inherit' }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              {toast.title && (
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {toast.title}
                </Typography>
              )}
              <Typography variant="body2">
                {toast.message}
              </Typography>
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
