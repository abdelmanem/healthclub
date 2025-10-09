import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Slide,
  Fade,
  Backdrop,
  Typography,
  Divider
} from '@mui/material';
import { Close, Save, Cancel } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export interface EnhancedDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  saveText?: string;
  cancelText?: string;
  showSaveButton?: boolean;
  showCancelButton?: boolean;
  disableSave?: boolean;
  disableCancel?: boolean;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
  dividers?: boolean;
  icon?: React.ReactElement;
  subtitle?: string;
}

export const EnhancedDialog: React.FC<EnhancedDialogProps> = ({
  open,
  onClose,
  onSave,
  title,
  children,
  maxWidth = 'md',
  fullWidth = true,
  loading = false,
  saveText = 'Save',
  cancelText = 'Cancel',
  showSaveButton = true,
  showCancelButton = true,
  disableSave = false,
  disableCancel = false,
  stickyHeader = true,
  stickyFooter = true,
  dividers = true,
  icon,
  subtitle
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={SlideTransition}
      BackdropComponent={({ children, ...props }) => (
        <Backdrop {...props} sx={{ bgcolor: 'rgba(0, 0, 0, 0.5)' }}>
          <Fade in={props.open}>
            <Box>{children}</Box>
          </Fade>
        </Backdrop>
      )}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          minHeight: '400px',
          maxHeight: '90vh'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          position: stickyHeader ? 'sticky' : 'static',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: 3
        }}
      >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {icon && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {icon}
              </Box>
            )}
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={disableCancel}
          sx={{ 
            color: 'inherit',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {dividers && <Divider />}

      {/* Content */}
      <DialogContent
        sx={{
          p: 3,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'grey.100',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'grey.400',
            borderRadius: '4px',
            '&:hover': {
              bgcolor: 'grey.500',
            },
          },
        }}
      >
        {children}
      </DialogContent>

      {dividers && <Divider />}

      {/* Footer */}
      {(showSaveButton || showCancelButton) && (
        <DialogActions
          sx={{
            position: stickyFooter ? 'sticky' : 'static',
            bottom: 0,
            bgcolor: 'grey.50',
            px: 3,
            py: 2,
            gap: 1
          }}
        >
          {showCancelButton && (
            <Button
              onClick={onClose}
              disabled={disableCancel || loading}
              startIcon={<Cancel />}
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              {cancelText}
            </Button>
          )}
          {showSaveButton && onSave && (
            <Button
              onClick={onSave}
              disabled={disableSave || loading}
              startIcon={loading ? <Box sx={{ width: 16, height: 16 }} /> : <Save />}
              variant="contained"
              sx={{ minWidth: 100 }}
            >
              {loading ? 'Saving...' : saveText}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};
