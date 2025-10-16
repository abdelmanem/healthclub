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

  const showConfirmDialog = useCallback((cfg: ConfirmDialogConfig): Promise<ConfirmDialogResult> => {
    return new Promise((resolve) => {
      setConfig(cfg);
      setResolver(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolver) resolver({ confirmed: false });
    setConfig(null);
    setResolver(null);
  }, [resolver]);

  const handleConfirm = useCallback((value?: string) => {
    if (resolver) resolver({ confirmed: true, value });
    setConfig(null);
    setResolver(null);
  }, [resolver]);

  return {
    showConfirmDialog,
    dialogConfig: config,
    onDialogClose: handleClose,
    onDialogConfirm: handleConfirm,
  };
};


