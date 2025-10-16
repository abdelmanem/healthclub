# Invoice System - Comprehensive Code Review & Recommendations

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [High Priority Issues](#high-priority-issues)
4. [Medium Priority Issues](#medium-priority-issues)
5. [Best Practices & Enhancements](#best-practices--enhancements)
6. [Security Recommendations](#security-recommendations)
7. [Performance Optimizations](#performance-optimizations)
8. [Testing Strategy](#testing-strategy)
9. [Complete Refactored Examples](#complete-refactored-examples)

---

## 📊 Executive Summary

### Overall Assessment
Your codebase is **well-structured** with good separation of concerns. The backend has strong concurrency controls, but the frontend doesn't leverage these protections effectively.

### Key Strengths ✅
- Good use of `select_for_update()` for row-level locking
- Optimistic locking with `version` field
- Comprehensive serializers with validation
- Well-documented API endpoints
- Idempotency keys for payment processing
- Good use of TypeScript for type safety

### Critical Gaps ❌
- Frontend doesn't use optimistic locking
- Using `prompt()`/`alert()` instead of proper dialogs
- No error boundaries
- Memory leaks in useEffect hooks
- Missing loading states for some actions
- No retry logic for failed requests

---

## 🔴 Critical Issues (Fix Immediately)

### 1. Optimistic Locking Not Implemented in Frontend

**Impact:** Data loss when two users modify the same invoice simultaneously

**Current Code:**
```typescript
// ❌ InvoiceDetails.tsx - No version checking
const handleCancel = async () => {
  await invoicesService.cancel(invoice.id, { reason });
};
```

**Solution:**

#### Step 1: Update TypeScript Types

```typescript
// services/invoices.ts

export interface Invoice {
  // ... existing fields ...
  version: number; // ✅ Add version field
}

export interface CancelInvoiceRequest {
  reason: string;
  version: number; // ✅ Required for optimistic locking
}

export interface ApplyDiscountRequest {
  discount: string;
  reason?: string;
  version: number; // ✅ Add to all write operations
}
```

#### Step 2: Update Backend Views

```python
# views.py

@action(detail=True, methods=['post'])
def cancel(self, request, pk=None):
    """Cancel invoice with optimistic locking"""
    
    version = request.data.get('version')
    
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=pk)
        
        # ✅ Version conflict check
        if version is not None and invoice.version != version:
            return Response(
                {
                    'error': 'Invoice was modified by another user. Please refresh.',
                    'current_version': invoice.version,
                    'requested_version': version,
                    'conflict': True
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Validation
        if invoice.amount_paid > 0:
            return Response(
                {'error': 'Cannot cancel invoice with payments.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update
        invoice.status = 'cancelled'
        reason = request.data.get('reason', '')
        if reason:
            invoice.notes = f"{invoice.notes}\n\nCancelled: {reason}".strip()
        
        # ✅ Increment version
        invoice.version += 1
        invoice.save(update_fields=['status', 'notes', 'version'])
    
    return Response({
        'success': True,
        'invoice_status': invoice.status,
        'version': invoice.version,  # ✅ Return new version
        'message': 'Invoice cancelled successfully'
    })
```

**Apply version checking to ALL write endpoints:**
- `apply_discount`
- `process_payment`
- `refund`
- `mark_paid`
- `update` (PATCH)

#### Step 3: Update Frontend Services

```typescript
// services/invoices.ts

async cancel(
  invoiceId: number, 
  data: CancelInvoiceRequest
): Promise<{ 
  success: boolean; 
  message: string; 
  version: number;
  invoice_status: string;
}> {
  const response = await api.post(`/invoices/${invoiceId}/cancel/`, data);
  return response.data;
}

async applyDiscount(
  invoiceId: number,
  data: ApplyDiscountRequest
): Promise<{
  success: boolean;
  version: number;
  new_total: string;
  new_balance_due: string;
}> {
  const response = await api.post(`/invoices/${invoiceId}/apply_discount/`, data);
  return response.data;
}
```

#### Step 4: Update Frontend Components

```typescript
// InvoiceDetails.tsx

const handleCancel = async () => {
  if (!invoice) return;
  
  const result = await showConfirmDialog({
    title: 'Cancel Invoice',
    message: `Cancel invoice ${invoice.invoice_number}?`,
    confirmText: 'Cancel Invoice',
    confirmColor: 'error',
    inputLabel: 'Cancellation Reason',
    inputRequired: true,
  });
  
  if (!result.confirmed) return;

  setActionLoading(true);
  try {
    // ✅ Include version
    const response = await invoicesService.cancel(invoice.id, { 
      reason: result.value!,
      version: invoice.version 
    });
    
    // ✅ Update local state with new version
    setInvoice(prev => prev ? { 
      ...prev, 
      version: response.version,
      status: response.invoice_status 
    } : null);
    
    showSnackbar('Invoice cancelled successfully', 'success');
    await loadInvoice();
    onInvoiceCancelled?.();
    
  } catch (error: any) {
    // ✅ Handle version conflict (409)
    if (error?.response?.status === 409) {
      showSnackbar(
        'Invoice was modified by another user. Refreshing...',
        'warning'
      );
      await loadInvoice(); // Reload to get latest version
    } else {
      showSnackbar(
        error?.response?.data?.error || 'Failed to cancel invoice',
        'error'
      );
    }
  } finally {
    setActionLoading(false);
  }
};
```

---

### 2. Replace prompt() and alert() with Proper Dialogs

**Impact:** Poor UX, not accessible, blocks UI, no validation

**Problems:**
- `prompt()` blocks the entire browser
- `alert()` can't be styled or controlled
- Not accessible to screen readers
- No input validation
- Poor mobile experience

**Solution: Create Reusable Dialog System**

#### Create ConfirmDialog Component

```typescript
// components/common/ConfirmDialog.tsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  inputLabel?: string;
  inputRequired?: boolean;
  inputType?: 'text' | 'number';
  inputPlaceholder?: string;
  inputHelperText?: string;
  inputMultiline?: boolean;
  inputRows?: number;
  validationError?: string;
  maxValue?: number;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  inputLabel,
  inputRequired = false,
  inputType = 'text',
  inputPlaceholder,
  inputHelperText,
  inputMultiline = false,
  inputRows = 3,
  validationError,
  maxValue,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setInputValue('');
      setError('');
    }
  }, [open]);

  const handleConfirm = () => {
    // Validation
    if (inputRequired && !inputValue.trim()) {
      setError(`${inputLabel || 'Input'} is required`);
      return;
    }

    if (inputType === 'number' && inputValue) {
      const num = parseFloat(inputValue);
      if (isNaN(num) || num <= 0) {
        setError('Please enter a valid positive number');
        return;
      }
      if (maxValue && num > maxValue) {
        setError(`Value cannot exceed ${maxValue}`);
        return;
      }
    }

    onConfirm(inputValue);
    handleClose();
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: inputLabel ? 2 : 0 }}>
          {message}
        </Typography>

        {inputLabel && (
          <TextField
            autoFocus
            label={inputLabel}
            type={inputType}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            fullWidth
            required={inputRequired}
            placeholder={inputPlaceholder}
            helperText={error || inputHelperText}
            error={!!error}
            multiline={inputMultiline}
            rows={inputMultiline ? inputRows : 1}
            sx={{ mt: 2 }}
            inputProps={{
              min: inputType === 'number' ? 0.01 : undefined,
              max: inputType === 'number' && maxValue ? maxValue : undefined,
              step: inputType === 'number' ? 0.01 : undefined,
            }}
          />
        )}

        {validationError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{cancelText}</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color={confirmColor}
          disabled={inputRequired && !inputValue.trim()}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

#### Create useConfirmDialog Hook

```typescript
// components/common/useConfirmDialog.tsx

import { useState, useCallback } from 'react';

interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  inputLabel?: string;
  inputRequired?: boolean;
  inputType?: 'text' | 'number';
  inputPlaceholder?: string;
  inputHelperText?: string;
  inputMultiline?: boolean;
  inputRows?: number;
  maxValue?: number;
}

interface ConfirmDialogResult {
  confirmed: boolean;
  value?: string;
}

export const useConfirmDialog = () => {
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);
  const [resolver, setResolver] = useState<((result: ConfirmDialogResult) => void) | null>(null);

  const showConfirmDialog = useCallback((config: ConfirmDialogConfig): Promise<ConfirmDialogResult> => {
    return new Promise((resolve) => {
      setConfig(config);
      setResolver(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolver) {
      resolver({ confirmed: false });
    }
    setConfig(null);
    setResolver(null);
  }, [resolver]);

  const handleConfirm = useCallback((value?: string) => {
    if (resolver) {
      resolver({ confirmed: true, value });
    }
    setConfig(null);
    setResolver(null);
  }, [resolver]);

  return {
    showConfirmDialog,
    dialogProps: {
      open: !!config,
      onClose: handleClose,
      onConfirm: handleConfirm,
      ...config,
    },
  };
};
```

#### Usage Example

```typescript
// InvoiceDetails.tsx

import { useConfirmDialog } from '../common/useConfirmDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = (props) => {
  const { showConfirmDialog, dialogProps } = useConfirmDialog();

  // ✅ Cancel invoice with dialog
  const handleCancel = async () => {
    const result = await showConfirmDialog({
      title: 'Cancel Invoice',
      message: `Are you sure you want to cancel invoice ${invoice?.invoice_number}?`,
      confirmText: 'Cancel Invoice',
      confirmColor: 'error',
      inputLabel: 'Cancellation Reason',
      inputRequired: true,
      inputMultiline: true,
      inputPlaceholder: 'e.g., Guest cancelled appointment',
    });
    
    if (!result.confirmed) return;
    // ... process cancellation
  };

  // ✅ Apply discount with validation
  const handleApplyDiscount = async () => {
    const result = await showConfirmDialog({
      title: 'Apply Discount',
      message: `Current total: ${formatCurrency(invoice?.total || '0')}`,
      confirmText: 'Apply Discount',
      inputLabel: 'Discount Amount',
      inputRequired: true,
      inputType: 'number',
      inputPlaceholder: '10.00',
      inputHelperText: `Maximum: ${formatCurrency(invoice?.subtotal || '0')}`,
      maxValue: parseFloat(invoice?.subtotal || '0'),
    });
    
    if (!result.confirmed) return;

    // Optional: Ask for reason
    const reasonResult = await showConfirmDialog({
      title: 'Discount Reason',
      message: 'Please provide a reason for this discount',
      inputLabel: 'Reason',
      inputMultiline: true,
      inputPlaceholder: 'e.g., Loyalty member - 10% off',
    });

    // ... process discount
  };

  return (
    <Box>
      {/* ... existing JSX ... */}
      <ConfirmDialog {...dialogProps} />
    </Box>
  );
};
```

---

### 3. Add Snackbar for Success/Error Messages

**Replace all `alert()` calls with Material-UI Snackbar**

#### Create useSnackbar Hook

```typescript
// components/common/useSnackbar.tsx

import { useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showSnackbar = useCallback((
    message: string, 
    severity: AlertColor = 'info'
  ) => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  const SnackbarComponent = (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={handleClose} 
        severity={snackbar.severity} 
        sx={{ width: '100%' }}
        variant="filled"
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );

  return { showSnackbar, SnackbarComponent };
};
```

#### Usage

```typescript
// InvoiceDetails.tsx

import { useSnackbar } from '../common/useSnackbar';

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = (props) => {
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // ✅ Replace alert() with snackbar
  const handleSendEmail = async () => {
    if (!invoice) return;

    setActionLoading(true);
    try {
      await invoicesService.sendToGuest(invoice.id, {});
      showSnackbar('Invoice sent successfully', 'success');
    } catch (error: any) {
      showSnackbar(
        error?.response?.data?.error || 'Failed to send invoice',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box>
      {/* ... existing JSX ... */}
      {SnackbarComponent}
    </Box>
  );
};
```

---

### 4. Fix Memory Leaks in useEffect

**Problem:** Setting state after component unmounts causes memory leaks

**Current Code (PaymentDialog.tsx):**
```typescript
// ❌ Memory leak - no cleanup
useEffect(() => {
  const loadPaymentMethods = async (retryCount = 0) => {
    try {
      const methods = await paymentMethodsService.list();
      setPaymentMethods(methods); // May update after unmount
    } catch (error: any) {
      setTimeout(() => {
        loadPaymentMethods(retryCount + 1); // Timeout not cancelled
      }, 1000);
    }
  };
  if (open) {
    loadPaymentMethods();
  }
}, [open]);
```

**Solution:**

```typescript
// ✅ Proper cleanup
useEffect(() => {
  let mounted = true;
  let timeoutId: NodeJS.Timeout | null = null;
  let retryCount = 0;

  const loadPaymentMethods = async () => {
    try {
      const methods = await paymentMethodsService.list();
      
      // Only update if still mounted
      if (mounted) {
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedMethod(methods[0]);
        }
        setError('');
      }
    } catch (error: any) {
      if (!mounted) return;
      
      console.error('Failed to load payment methods:', error);
      
      // Retry on auth errors (token might be refreshing)
      if (error?.response?.status === 401 && retryCount < 2) {
        timeoutId = setTimeout(() => {
          if (mounted) {
            retryCount++;
            loadPaymentMethods();
          }
        }, 1000);
      } else {
        setError('Failed to load payment methods');
      }
    }
  };

  if (open) {
    loadPaymentMethods();
  }

  // Cleanup function
  return () => {
    mounted = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}, [open]);
```

**Apply this pattern to all async useEffect hooks in:**
- InvoiceDetails.tsx (loadInvoice)
- PaymentDialog.tsx (loadPaymentMethods)
- RefundDialog.tsx (any async operations)

---

### 5. Add Error Boundaries

**Problem:** Unhandled errors crash the entire app

**Solution: Create Error Boundary Component**

```typescript
// components/common/ErrorBoundary.tsx

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
```

#### Usage

```typescript
// App.tsx or parent component

import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <InvoiceManagementApp />
    </ErrorBoundary>
  );
}

// Or wrap individual features
<ErrorBoundary>
  <InvoiceDetails invoiceId={42} />
</ErrorBoundary>

<ErrorBoundary>
  <PaymentDialog open={open} invoice={invoice} />
</ErrorBoundary>
```

---

## 🟡 High Priority Issues

### 6. Backend - Add Version to All Write Responses

**All write operations should return the new version**

```python
# views.py - Apply to all write operations

@action(detail=True, methods=['post'])
def apply_discount(self, request, pk=None):
    """Apply discount with version tracking"""
    invoice = self.get_object()
    
    # Check version
    version = request.data.get('version')
    if version is not None and invoice.version != version:
        return Response(
            {'error': 'Invoice was modified by another user.', 'conflict': True},
            status=status.HTTP_409_CONFLICT
        )
    
    # ... validation and business logic ...
    
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=pk)
        invoice.discount = discount
        if reason:
            invoice.notes = f"{invoice.notes}\n\nDiscount: {reason}".strip()
        invoice.version += 1  # ✅ Increment version
        invoice.save(update_fields=['discount', 'notes', 'version'])
        
        invoice.recalculate_totals()
    
    invoice.refresh_from_db()
    
    return Response({
        'success': True,
        'version': invoice.version,  # ✅ Return new version
        'previous_total': str(previous_total),
        'discount_applied': str(discount),
        'new_total': str(invoice.total),
        'new_balance_due': str(invoice.balance_due),
        'message': f'Discount of ${discount} applied'
    })
```

---

### 7. Add Input Validation to Frontend

**Current:** Minimal validation before API calls  
**Issue:** Poor user experience, unnecessary API calls

#### Create Validation Utilities

```typescript
// utils/validation.ts

export const validateAmount = (
  value: string,
  min: number = 0.01,
  max?: number
): { valid: boolean; error?: string } => {
  const num = parseFloat(value);
  
  if (!value || value.trim() === '') {
    return { valid: false, error: 'Amount is required' };
  }
  
  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  
  if (num < min) {
    return { valid: false, error: `Amount must be at least $${min.toFixed(2)}` };
  }
  
  if (max && num > max) {
    return { valid: false, error: `Amount cannot exceed $${max.toFixed(2)}` };
  }
  
  return { valid: true };
};

export const validateRequired = (
  value: string,
  fieldName: string = 'Field'
): { valid: boolean; error?: string } => {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
};

export const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `$${num.toFixed(2)}`;
};
```

#### Use in Components

```typescript
// PaymentDialog.tsx

import { validateAmount, validateRequired } from '../../utils/validation';

const handleSubmit = async () => {
  setError('');

  // ✅ Frontend validation
  if (!selectedMethod) {
    setError('Please select a payment method');
    return;
  }

  const amountValidation = validateAmount(
    amount, 
    0.01, 
    parseFloat(invoice.balance_due)
  );
  
  if (!amountValidation.valid) {
    setError(amountValidation.error!);
    return;
  }

  if (selectedMethod.requires_reference) {
    const refValidation = validateRequired(referenceNumber, 'Reference number');
    if (!refValidation.valid) {
      setError(refValidation.error!);
      return;
    }
  }

  // ✅ Proceed with API call
  setProcessing(true);
  try {
    await invoicesService.processPayment(invoice.id, {
      amount,
      payment_method: selectedMethod.id,
      payment_type: paymentType,
      reference: referenceNumber || undefined,
      transaction_id: transactionId || undefined,
      notes: notes || undefined,
      idempotency_key: `${invoice.id}-${selectedMethod.id}-${amount}-${Date.now()}`,
      version: invoice.version, // ✅ Include version
    });
    
    showSnackbar('Payment processed successfully', 'success');
    onPaymentProcessed();
    onClose();
    
  } catch (error: any) {
    if (error?.response?.status === 409) {
      setError('Invoice was modified. Please refresh and try again.');
    } else {
      setError(error?.response?.data?.error || 'Failed to process payment');
    }
  } finally {
    setProcessing(false);
  }
};
```

---

### 8. Improve Error Handling

**Current:** Generic error messages  
**Better:** Specific, actionable messages

#### Create Error Handler Utility

```typescript
// utils/errorHandler.ts

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
```

#### Usage

```typescript
// InvoiceDetails.tsx

import { handleApiError } from '../../utils/errorHandler';

const handleCancel = async () => {
  if (!invoice) return;
  
  // ... dialog and validation ...

  setActionLoading(true);
  try {
    await invoicesService.cancel(invoice.id, { 
      reason: result.value!,
      version: invoice.version 
    });
    showSnackbar('Invoice cancelled successfully', 'success');
    await loadInvoice();
    onInvoiceCancelled?.();
    
  } catch (error: any) {
    // ✅ Centralized error handling
    handleApiError(error, showSnackbar, loadInvoice);
  } finally {
    setActionLoading(false);
  }
};
```

---

### 9. Add Loading States for All Actions

**Current:** Some actions missing loading indicators

```typescript
// InvoiceDetails.tsx

const [loadingStates, setLoadingStates] = useState({
  cancelling: false,
  applyingDiscount: false,
  sendingEmail: false,
});

const setLoadingState = (key: keyof typeof loadingStates, value: boolean) => {
  setLoadingStates(prev => ({ ...prev, [key]: value }));
};

// ✅ Use specific loading states
const handleCancel = async () => {
  // ... validation ...
  
  setLoadingState('cancelling', true);
  try {
    // ... API call ...
  } finally {
    setLoadingState('cancelling', false);
  }
};

// In JSX
<Button
  variant="outlined"
  color="error"
  startIcon={loadingStates.cancelling ? <CircularProgress size={20} /> : <Cancel />}
  onClick={handleCancel}
  disabled={loadingStates.cancelling}
>
  {loadingStates.cancelling ? 'Cancelling...' : 'Cancel Invoice'}
</Button>
```

---

### 10. Backend - Add Request Validation Middleware

**Add comprehensive request validation**

```python
# utils/validators.py

from decimal import Decimal, InvalidOperation
from rest_framework import serializers

def validate_positive_decimal(value, field_name="Value"):
    """Validate positive decimal amount"""
    try:
        decimal_value = Decimal(str(value))
        if decimal_value <= 0:
            raise serializers.ValidationError(
                f"{field_name} must be greater than zero"
            )
        return decimal_value
    except (InvalidOperation, ValueError):
        raise serializers.ValidationError(
            f"{field_name} must be a valid number"
        )

def validate_amount_against_balance(amount, balance_due):
    """Validate payment amount doesn't exceed balance"""
    if amount > balance_due:
        raise serializers.ValidationError(
            f"Amount ${amount} cannot exceed balance due of ${balance_due}"
        )

def validate_refund_amount(amount, amount_paid):
    """Validate refund amount doesn't exceed amount paid"""
    if amount > amount_paid:
        raise serializers.ValidationError(
            f"Refund amount ${amount} cannot exceed amount paid ${amount_paid}"
        )
```

**Use in serializers:**

```python
# serializers.py

class ProcessPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True
    )
    
    # ... other fields ...
    
    def validate_amount(self, value):
        """Additional amount validation"""
        from .utils.validators import validate_positive_decimal
        return validate_positive_decimal(value, "Payment amount")
    
    def validate(self, data):
        """Cross-field validation"""
        payment_method = data.get('payment_method')
        reference = data.get('reference', '')
        
        if payment_method and payment_method.requires_reference and not reference:
            raise serializers.ValidationError({
                'reference': f'{payment_method.name} requires a reference number'
            })
        
        return data
```

---

## 🟠 Medium Priority Issues

### 11. Add Retry Logic for Failed Requests

**Handle transient failures gracefully**

```typescript
// utils/retry.ts

interface RetryConfig {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export const retryAsync = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = config;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx except 408, 429)
      const status = error?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const retryDelay = delay * Math.pow(backoff, attempt);
      
      onRetry?.(attempt + 1, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError;
};
```

**Usage:**

```typescript
// services/invoices.ts

import { retryAsync } from '../utils/retry';

export const invoicesService = {
  async retrieve(id: number): Promise<Invoice> {
    return retryAsync(
      async () => {
        const response = await api.get(`/invoices/${id}/`);
        return response.data;
      },
      {
        maxRetries: 3,
        delay: 1000,
        onRetry: (attempt, error) => {
          console.log(`Retrying invoice fetch (attempt ${attempt})`, error);
        },
      }
    );
  },
  
  // Don't retry write operations - use idempotency instead
  async processPayment(invoiceId: number, data: ProcessPaymentRequest) {
    const response = await api.post(`/invoices/${invoiceId}/process_payment/`, data);
    return response.data;
  },
};
```

---

### 12. Improve Currency Formatting

**Current:** Inconsistent formatting  
**Better:** Centralized, locale-aware formatting

```typescript
// utils/currency.ts

interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export const formatCurrency = (
  amount: string | number,
  options: CurrencyFormatOptions = {}
): string => {
  const {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return '$0.00';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
};

export const parseCurrency = (value: string): number => {
  // Remove currency symbols and commas
  const cleaned = value.replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
};

export const validateCurrencyInput = (value: string): boolean => {
  // Allow digits, one decimal point, and up to 2 decimal places
  const regex = /^\d+(\.\d{0,2})?$/;
  return regex.test(value);
};
```

**Usage:**

```typescript
// InvoiceDetails.tsx

import { formatCurrency } from '../../utils/currency';

// ✅ Consistent formatting throughout
<Typography variant="h6">
  Total: {formatCurrency(invoice.total)}
</Typography>

<Typography variant="body2">
  Balance Due: {formatCurrency(invoice.balance_due)}
</Typography>
```

---

### 13. Add Optimistic UI Updates

**Update UI immediately, rollback on error**

```typescript
// InvoiceDetails.tsx

const handleApplyDiscount = async () => {
  if (!invoice) return;

  const result = await showConfirmDialog({
    title: 'Apply Discount',
    inputLabel: 'Discount Amount',
    inputRequired: true,
    inputType: 'number',
    maxValue: parseFloat(invoice.subtotal),
  });

  if (!result.confirmed) return;

  const discountAmount = result.value!;
  
  // ✅ Optimistic update - update UI immediately
  const previousInvoice = { ...invoice };
  const newTotal = parseFloat(invoice.total) - parseFloat(discountAmount);
  const newBalanceDue = parseFloat(invoice.balance_due) - parseFloat(discountAmount);
  
  setInvoice(prev => prev ? {
    ...prev,
    discount: discountAmount,
    total: newTotal.toFixed(2),
    balance_due: newBalanceDue.toFixed(2),
  } : null);

  try {
    const response = await invoicesService.applyDiscount(invoice.id, {
      discount: discountAmount,
      version: invoice.version,
    });
    
    // ✅ Update with server response
    setInvoice(prev => prev ? {
      ...prev,
      ...response,
      version: response.version,
    } : null);
    
    showSnackbar('Discount applied successfully', 'success');
    
  } catch (error: any) {
    // ✅ Rollback on error
    setInvoice(previousInvoice);
    handleApiError(error, showSnackbar, loadInvoice);
  }
};
```

---

### 14. Add Debouncing for Search/Filter

**Prevent excessive API calls during typing**

```typescript
// hooks/useDebounce.ts

import { useState, useEffect } from 'react';

export const useDebounce = <T>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
```

**Usage in invoice search:**

```typescript
// InvoiceList.tsx (example)

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  // Only triggers 500ms after user stops typing
  if (debouncedSearch) {
    fetchInvoices({ search: debouncedSearch });
  }
}, [debouncedSearch]);

<TextField
  label="Search Invoices"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Search by invoice number, guest name..."
/>
```

---

### 15. Add Caching for Payment Methods

**Cache payment methods to reduce API calls**

```typescript
// services/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const cache = new SimpleCache();
```

**Use in payment methods service:**

```typescript
// services/invoices.ts

import { cache } from './cache';

export const paymentMethodsService = {
  async list(): Promise<PaymentMethod[]> {
    const CACHE_KEY = 'payment_methods';
    
    // ✅ Check cache first
    const cached = cache.get<PaymentMethod[]>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const response = await api.get('/payment-methods/');
    const methods = response.data.results ?? response.data;
    
    // ✅ Cache for 10 minutes
    cache.set(CACHE_KEY, methods, 10 * 60 * 1000);
    
    return methods;
  },
  
  // Clear cache when methods are modified
  clearCache(): void {
    cache.clear('payment_methods');
  },
};
```

---

## 🟢 Best Practices & Enhancements

### 16. Add TypeScript Strict Mode

**Enable stricter type checking**

```json
// tsconfig.json

{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

### 17. Add Logging Service

**Centralized logging for debugging and monitoring**

```typescript
// services/logger.ts

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Console output
    if (this.isDevelopment) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                           level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}]`, message, context || '');
    }

    // TODO: Send to logging service (e.g., Sentry, LogRocket)
    // this.sendToService(entry);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: any, context?: Record<string, any>): void {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
    };
    this.log(LogLevel.ERROR, message, errorContext);
  }
}

export const logger = new Logger();
```

**Usage:**

```typescript
// InvoiceDetails.tsx

import { logger } from '../../services/logger';

const loadInvoice = async () => {
  setLoading(true);
  try {
    logger.info('Loading invoice', { invoiceId });
    const data = await invoicesService.retrieve(invoiceId);
    setInvoice(data);
    logger.debug('Invoice loaded successfully', { invoice: data });
  } catch (error) {
    logger.error('Failed to load invoice', error, { invoiceId });
  } finally {
    setLoading(false);
  }
};
```

---

### 18. Add API Request Interceptors

**Centralized request/response handling**

```typescript
// services/api.ts

import axios from 'axios';
import { logger } from './logger';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    logger.debug('API Request', {
      method: config.method,
      url: config.url,
      data: config.data,
    });
    
    return config;
  },
  (error) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    logger.debug('API Response', {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Token refresh logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/token/refresh/', {
          refresh: refreshToken,
        });
        
        const newToken = response.data.access;
        localStorage.setItem('authToken', newToken);
        
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    logger.error('API Error', error, {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    return Promise.reject(error);
  }
);

export { api };
```

---

### 19. Backend - Add Rate Limiting

**Protect against abuse and DDoS**

```python
# settings.py

REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'payment': '50/hour',  # Custom rate for payment processing
    },
}
```

```python
# throttles.py

from rest_framework.throttling import UserRateThrottle

class PaymentRateThrottle(UserRateThrottle):
    """Stricter rate limit for payment processing"""
    scope = 'payment'
    
    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f'throttle_payment_{request.user.pk}'
        return None
```

```python
# views.py

from .throttles import PaymentRateThrottle

class InvoiceViewSet(viewsets.ModelViewSet):
    @action(detail=True, methods=['post'], throttle_classes=[PaymentRateThrottle])
    def process_payment(self, request, pk=None):
        """Process payment with rate limiting"""
        # ... implementation ...
```

---

### 20. Add Comprehensive Logging in Backend

**Track all important operations**

```python
# utils/logging.py

import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def log_payment_attempt(invoice, user, amount, payment_method):
    """Log payment processing attempt"""
    logger.info(
        f"Payment attempt: Invoice {invoice.invoice_number}, "
        f"Amount: ${amount}, Method: {payment_method}, "
        f"User: {user.username}"
    )

def log_payment_success(invoice, payment):
    """Log successful payment"""
    logger.info(
        f"Payment successful: Invoice {invoice.invoice_number}, "
        f"Payment ID: {payment.id}, Amount: ${payment.amount}"
    )

def log_payment_failure(invoice, user, error):
    """Log payment failure"""
    logger.error(
        f"Payment failed: Invoice {invoice.invoice_number}, "
        f"User: {user.username}, Error: {str(error)}"
    )

def log_refund_request(invoice, user, amount, reason):
    """Log refund request"""
    logger.warning(
        f"Refund requested: Invoice {invoice.invoice_number}, "
        f"Amount: ${amount}, Reason: {reason}, "
        f"Requested by: {user.username}"
    )

def log_invoice_cancellation(invoice, user, reason):
    """Log invoice cancellation"""
    logger.warning(
        f"Invoice cancelled: {invoice.invoice_number}, "
        f"Reason: {reason}, Cancelled by: {user.username}"
    )
```

**Use in views:**

```python
# views.py

from .utils.logging import (
    log_payment_attempt,
    log_payment_success,
    log_payment_failure,
)

@action(detail=True, methods=['post'])
def process_payment(self, request, pk=None):
    invoice = self.get_object()
    serializer = ProcessPaymentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    amount = serializer.validated_data['amount']
    payment_method = serializer.validated_data['payment_method']
    
    # ✅ Log attempt
    log_payment_attempt(invoice, request.user, amount, payment_method.name)
    
    try:
        with transaction.atomic():
            # ... payment processing ...
            payment = Payment.objects.create(...)
            
        # ✅ Log success
        log_payment_success(invoice, payment)
        
        return Response({...})
        
    except Exception as e:
        # ✅ Log failure
        log_payment_failure(invoice, request.user, e)
        raise
```

---

## 🔒 Security Recommendations

### 21. Add CSRF Protection for State-Changing Operations

**Already handled by Django REST Framework, but ensure it's configured**

```python
# settings.py

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # ✅ Includes CSRF
    ],
}

# Ensure CSRF cookie is set
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read for AJAX
CSRF_COOKIE_SAMESITE = 'Strict'
CSRF_TRUSTED_ORIGINS = ['https://yourdomain.com']
```

**Frontend - Include CSRF token:**

```typescript
// services/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true,  // ✅ Include cookies
});

// Add CSRF token to requests
api.interceptors.request.use((config) => {
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
    
  if (csrfToken && config.method !== 'get') {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  
  return config;
});
```

---

### 22. Add Input Sanitization

**Prevent XSS attacks**

```typescript
// utils/sanitize.ts

import DOMPurify from 'dompurify';

export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
  });
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
};
```

**Use before displaying user input:**

```typescript
// InvoiceDetails.tsx

<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
  {sanitizeHtml(invoice.notes)}
</Typography>
```

---

### 23. Add Permission Checks

**Backend - Ensure proper permissions**

```python
# permissions.py

from rest_framework import permissions

class CanProcessPayments(permissions.BasePermission):
    """Only users with payment processing permission"""
    
    def has_permission(self, request, view):
        return request.user.has_perm('pos.process_payments')

class CanIssueRefunds(permissions.BasePermission):
    """Only users with refund permission"""
    
    def has_permission(self, request, view):
        # Check if user has specific permission
        if not request.user.has_perm('pos.issue_refunds'):
            return False
        
        # Additional check: refunds over $500 require manager approval
        if view.action == 'refund':
            amount = request.data.get('amount', 0)
            if float(amount) > 500 and not request.user.is_manager:
                return False
        
        return True
```

**Use in views:**

```python
# views.py

class InvoiceViewSet(viewsets.ModelViewSet):
    @action(
        detail=True, 
        methods=['post'],
        permission_classes=[IsAuthenticated, CanProcessPayments]
    )
    def process_payment(self, request, pk=None):
        # ... implementation ...
    
    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, CanIssueRefunds]
    )
    def refund(self, request, pk=None):
        # ... implementation ...
```

---

### 24. Sensitive Data Handling

**Don't log sensitive information**

```python
# utils/logging.py

def sanitize_payment_data(data):
    """Remove sensitive payment info from logs"""
    sanitized = data.copy()
    
    # Mask card numbers
    if 'reference' in sanitized:
        ref = sanitized['reference']
        if len(ref) > 4:
            sanitized['reference'] = f"****{ref[-4:]}"
    
    # Remove transaction IDs
    if 'transaction_id' in sanitized:
        sanitized['transaction_id'] = '***REDACTED***'
    
    return sanitized

# Use when logging
logger.info("Payment processed", sanitize_payment_data(payment_data))
```

---

## ⚡ Performance Optimizations

### 25. Backend - Add Database Indexes

**Your models already have some indexes, but add more:**

```python
# models.py

class Invoice(models.Model):
    # ... existing fields ...
    
    class Meta:
        indexes = [
            models.Index(fields=['-date']),
            models.Index(fields=['guest', '-date']),
            models.Index(fields=['status']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['reservation']),
            models.Index(fields=['status', 'balance_due']),
            # ✅ Add these for better query performance
            models.Index(fields=['status', '-date']),
            models.Index(fields=['guest', 'status']),
            models.Index(fields=['due_date', 'status']),
            models.Index(fields=['created_at']),
        ]

class Payment(models.Model):
    # ... existing fields ...
    
    class Meta:
        indexes = [
            models.Index(fields=['-payment_date']),
            models.Index(fields=['invoice', '-payment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['method']),
            models.Index(fields=['idempotency_key']),
            # ✅ Add these
            models.Index(fields=['invoice', 'status']),
            models.Index(fields=['payment_method', '-payment_date']),
            models.Index(fields=['processed_by', '-payment_date']),
        ]
```

---

### 26. Backend - Optimize Queries with select_related and prefetch_related

**Your views already do this well, but ensure consistency:**

```python
# views.py

class InvoiceViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = Invoice.objects.all()
        
        # ✅ Always prefetch related data
        queryset = queryset.prefetch_related(
            'items',
            'items__service',
            'payments',
            'payments__payment_method',
            'payments__processed_by',
            'refunds',
            'refunds__requested_by',
        ).select_related(
            'guest',
            'reservation',
            'created_by',
        )
        
        # Apply filters
        # ... your existing filter logic ...
        
        return quer
