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
      title: config?.title || '',
      message: config?.message || '',
      confirmText: config?.confirmText,
      cancelText: config?.cancelText,
      confirmColor: config?.confirmColor,
      inputLabel: config?.inputLabel,
      inputRequired: config?.inputRequired,
      inputType: config?.inputType,
      inputPlaceholder: config?.inputPlaceholder,
      inputHelperText: config?.inputHelperText,
      inputMultiline: config?.inputMultiline,
      inputRows: config?.inputRows,
      maxValue: config?.maxValue,
    },
  };
};