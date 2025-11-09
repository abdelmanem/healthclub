import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography } from '@mui/material';
import { discountService, DiscountType } from '../../services/discounts';
import { useCurrencyFormatter } from '../../utils/currency';

interface InvoiceDiscountDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceTotal: number;
  onSubmit: (params: { discountAmount: string; reason?: string }) => void;
}

export const InvoiceDiscountDialog: React.FC<InvoiceDiscountDialogProps> = ({ open, onClose, invoiceTotal, onSubmit }) => {
  const [loading, setLoading] = React.useState(false);
  const [discountTypes, setDiscountTypes] = React.useState<DiscountType[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = React.useState<number | ''>('' as any);
  const [reason, setReason] = React.useState('');
  const [calculatedAmount, setCalculatedAmount] = React.useState<string>('0.00');
  const { formatCurrency } = useCurrencyFormatter();

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    discountService
      .listDiscountTypes({ is_active: true, is_valid_now: true })
      .then((list) => setDiscountTypes(list))
      .catch(() => setDiscountTypes([]))
      .finally(() => setLoading(false));
  }, [open]);

  React.useEffect(() => {
    const type = discountTypes.find((d) => d.id === selectedDiscountId);
    if (!type) {
      setCalculatedAmount('0.00');
      return;
    }
    const amount = discountService.calculateDiscountAmount(type, invoiceTotal);
    setCalculatedAmount(amount.toFixed(2));
  }, [selectedDiscountId, discountTypes, invoiceTotal]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Apply Discount</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Discount Type"
            value={selectedDiscountId}
            onChange={(e) => setSelectedDiscountId(Number(e.target.value) as any)}
            disabled={loading}
            fullWidth
          >
            <MenuItem value="">Select a discount</MenuItem>
            {discountTypes.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Invoice Total</Typography>
            <Typography>{formatCurrency(invoiceTotal)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Calculated Discount</Typography>
            <Typography>-{formatCurrency(calculatedAmount)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1">New Total</Typography>
            <Typography variant="subtitle1">{formatCurrency(invoiceTotal - Number(calculatedAmount))}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selectedDiscountId || Number(calculatedAmount) <= 0}
          onClick={() => onSubmit({ discountAmount: Number(calculatedAmount).toFixed(2), reason: reason || undefined })}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};


