interface ApiError {
  response?: {
    status: number;
    data?: {
      error?: string;
      message?: string;
      detail?: string;
      [key: string]: any;
    };
  };
  message?: string;
}

export const getErrorMessage = (error: any): string => {
  const apiError = error as ApiError;
  
  // Network error
  if (!apiError.response) {
    return 'Network error. Please check your connection and try again.';
  }
  
  const { status, data } = apiError.response;
  
  // Specific status codes
  switch (status) {
    case 400:
      return data?.error || data?.detail || 'Invalid request. Please check your input.';
    
    case 401:
      return 'Your session has expired. Please log in again.';
    
    case 403:
      return 'You do not have permission to perform this action.';
    
    case 404:
      return 'The requested resource was not found.';
    
    case 409:
      return data?.error || 'Conflict: The resource was modified by another user.';
    
    case 422:
      return data?.error || 'Validation error. Please check your input.';
    
    case 500:
      return 'Server error. Please try again later.';
    
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    
    default:
      return data?.error || data?.message || data?.detail || 'An unexpected error occurred.';
  }
};

export const handleApiError = (
  error: any,
  showSnackbar: (message: string, severity: 'error' | 'warning') => void,
  onConflict?: () => void
) => {
  const apiError = error as ApiError;
  
  if (apiError.response?.status === 409 && onConflict) {
    showSnackbar(
      'The resource was modified by another user. Refreshing...',
      'warning'
    );
    onConflict();
    return;
  }
  
  const message = getErrorMessage(error);
  showSnackbar(message, 'error');
};
