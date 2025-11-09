import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Stack,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Skeleton,
  Snackbar,
  Backdrop,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Undo,
  Cancel,
  Email,
  Print,
  AccountBalance,
  Download,
  Share,
  MoreVert,
  ContentCopy,
  Visibility,
  CheckCircle,
  Schedule,
  Warning,
  LocalOffer,
  Receipt,
  History,
  AttachMoney,
  Error as ErrorIcon,
} from '@mui/icons-material';
import html2pdf from 'html2pdf.js';
import './InvoiceDetails.css';
import { useConfiguration } from '../../contexts/ConfigurationContext';
import { PaymentDialog } from './PaymentDialog';
import { RefundDialog } from './RefundDialog';
import { DepositDialog } from './DepositDialog';
import { InvoiceDiscountDialog } from './InvoiceDiscountDialog';
import { invoicesService } from '../../services/invoices';

// Mock data for demonstration
const mockInvoice = {
  id: 1,
  invoice_number: 'INV-2024-001',
  status: 'partial',
  guest_name: 'John Smith',
  guest_email: 'john.smith@example.com',
  date: '2024-01-15',
  due_date: '2024-02-15',
  reservation_id: 'RES-123',
  created_by_name: 'Admin User',
  version: 1,
  items: [
    {
      id: 1,
      product_name: 'Spa Treatment Package',
      notes: 'Includes massage and facial',
      quantity: 2,
      unit_price: '150.00',
      tax_rate: '10.0',
      line_total: '330.00'
    },
    {
      id: 2,
      product_name: 'Room Service',
      notes: null,
      quantity: 1,
      unit_price: '75.00',
      tax_rate: '10.0',
      line_total: '82.50'
    },
    {
      id: 3,
      product_name: 'Deposit - Room Booking',
      notes: 'Non-refundable deposit',
      quantity: 1,
      unit_price: '200.00',
      tax_rate: '0.0',
      line_total: '200.00'
    }
  ],
  subtotal: '425.00',
  service_charge: '42.50',
  tax: '46.75',
  discount: '0.00',
  total: '514.25',
  amount_paid: '200.00',
  balance_due: '314.25',
  notes: 'Thank you for your business. Payment is due within 30 days.',
  can_be_paid: true,
  can_be_refunded: true,
  payments: [
    {
      id: 1,
      payment_type: 'deposit_application',
      method: 'Credit Card',
      payment_method_name: 'Visa **** 4242',
      amount: '200.00',
      payment_date: '2024-01-15T10:30:00',
      reference_number: 'REF-001',
      transaction_id: 'TXN-ABC123',
      notes: 'Initial deposit',
      processed_by_name: 'Admin User'
    }
  ],
  payment_summary: {
    total_payments: 1,
    payment_methods: ['Credit Card'],
    refund_amount: '0.00'
  }
};

type InvoiceDetailsProps = {
  invoiceId?: number;
  onClose?: () => void;
  onPaymentProcessed?: () => void;
};

const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({ invoiceId, onClose, onPaymentProcessed }) => {
  const { getConfigValue } = useConfiguration();
  const locale = getConfigValue('locale', 'en-US');
  // Try multiple config keys to locate system currency settings
  const currencyCode =
    getConfigValue('system_currency_code',
      getConfigValue('system_currency',
        getConfigValue('default_currency',
          getConfigValue('currency_code',
            getConfigValue('currency', undefined)))));
  const currencySymbol =
    getConfigValue('system_currency_symbol',
      getConfigValue('currency_symbol',
        getConfigValue('currency.sign', '')));
  const dateStyle = getConfigValue('date_style', undefined); // 'full' | 'long' | 'medium' | 'short'
  // If this is a demo, keep the old mockInvoice; in prod/fetch real data by invoiceId
  const [invoice, setInvoice] = useState<any>(invoiceId ? null : mockInvoice);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('payments');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInvoice = async () => {
      if (!invoiceId) return;
      setLoading(true);
      try {
        const { invoicesService } = await import('../../services/invoices');
        const data: any = await invoicesService.retrieve(invoiceId);
        if (isMounted) setInvoice(data);
      } catch {
        if (isMounted) setInvoice(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (invoiceId) {
      fetchInvoice();
    } else {
      setInvoice(mockInvoice);
    }
    return () => { isMounted = false; };
  }, [invoiceId]);

  const refreshInvoice = async () => {
    if (!invoiceId) return;
    try {
      const { invoicesService } = await import('../../services/invoices');
      const data: any = await invoicesService.retrieve(invoiceId);
      setInvoice(data);
    } catch {}
  };

  const getStatusIcon = (status: string): React.ReactElement => {
    const icons: { [key: string]: React.ReactElement } = {
      paid: <CheckCircle />, partial: <Schedule />, overdue: <Warning />, pending: <Schedule />, cancelled: <Cancel />
    };
    return icons[status] !== undefined ? icons[status] : <Receipt />;
  };

  const getStatusColor = (status: string): 'default' | 'warning' | 'info' | 'success' | 'error' | 'secondary' | 'primary' => {
    const colors: { [key: string]: 'default' | 'warning' | 'info' | 'success' | 'error' | 'secondary' | 'primary' } = {
      draft: 'default',
      pending: 'warning',
      issued: 'info',
      partial: 'info',
      paid: 'success',
      overdue: 'error',
      cancelled: 'default',
      refunded: 'secondary',
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount: string | number) => {
    const numericAmount = parseFloat(String(amount));
    if (Number.isNaN(numericAmount)) {
      // If we have a currency code, try to use it; otherwise use symbol
      if (currencyCode) {
        try {
          return new Intl.NumberFormat(locale, { style: 'currency', currency: String(currencyCode), maximumFractionDigits: 2 }).format(0);
        } catch {
          // If currency code is invalid (like "LE"), use it as symbol
          return `${currencyCode || currencySymbol || ''}0.00`;
        }
      }
      return `${currencySymbol || ''}0.00`;
    }
    
    try {
      if (currencyCode) {
        // Try to use currency code with Intl.NumberFormat
        return new Intl.NumberFormat(locale, { style: 'currency', currency: String(currencyCode), maximumFractionDigits: 2 }).format(numericAmount);
      }
    } catch {
      // If currency code is invalid (like "LE"), treat it as a symbol
      const symbol = currencyCode || currencySymbol || '';
      return `${symbol}${numericAmount.toFixed(2)}`;
    }
    
    // Fallback to symbol
    return `${currencySymbol || ''}${numericAmount.toFixed(2)}`;
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    if (dateStyle) {
      try {
        return d.toLocaleDateString(locale, { dateStyle });
      } catch {}
    }
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handlePrint = async () => {
    if (!invoice) return;
    
    setPrintLoading(true);
    try {
      if (printRef.current) {
        printRef.current.scrollIntoView({ block: 'start' });
      }
      // Wait a bit for any animations or layout updates
      await new Promise(resolve => setTimeout(resolve, 100));
      window.print();
      setSuccessMessage('Print dialog opened');
    } catch (error) {
      console.error('Print error:', error);
      setErrorMessage('Failed to open print dialog. Please try again.');
    } finally {
      setPrintLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice || !invoiceId) {
      setErrorMessage('Invoice data not available');
      return;
    }

    setPdfLoading(true);
    setErrorMessage(null);

    try {
      // First, try to use backend PDF generation (more reliable)
      try {
        const pdfBlob = await invoicesService.downloadPDF(invoiceId);
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.invoice_number || 'Invoice'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setSuccessMessage('PDF downloaded successfully');
        return;
      } catch (backendError) {
        console.warn('Backend PDF generation failed, falling back to client-side:', backendError);
        // Fall through to client-side generation
      }

      // Fallback to client-side PDF generation
      const element = printRef.current || document.getElementById('printable-invoice');
      if (!element) {
        throw new Error('Printable invoice element not found');
      }

      // Clone element for PDF generation
      const clonedElement = element.cloneNode(true) as HTMLElement;
      clonedElement.classList.add('pdf-generating');
      
      // Remove no-print elements
      clonedElement.querySelectorAll('.no-print').forEach(el => el.remove());
      
      // Show print-only elements
      clonedElement.querySelectorAll('.print-only').forEach(el => {
        (el as HTMLElement).style.display = 'block';
      });

      // Set up clone for PDF generation - make it visible but off-screen
      clonedElement.style.position = 'fixed';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      clonedElement.style.width = '800px';
      clonedElement.style.background = '#fff';
      clonedElement.style.maxWidth = '800px';
      clonedElement.style.margin = '0';
      clonedElement.style.padding = '20px';
      clonedElement.style.zIndex = '9999';
      clonedElement.style.visibility = 'visible';
      clonedElement.style.display = 'block';
      clonedElement.style.opacity = '1';
      // Ensure all children are visible
      const allChildren = clonedElement.querySelectorAll('*');
      allChildren.forEach((child: any) => {
        if (child.style) {
          child.style.visibility = 'visible';
          child.style.opacity = '1';
        }
      });
      document.body.appendChild(clonedElement);
      
      // Force a reflow to ensure rendering
      void clonedElement.offsetHeight;

      try {
        // Wait for fonts and images to load
        if ((document as any).fonts && (document as any).fonts.ready) {
          await (document as any).fonts.ready;
        }
        
        const images = Array.from(clonedElement.querySelectorAll('img')) as HTMLImageElement[];
        await Promise.all(
          images.map(img => 
            img.complete 
              ? Promise.resolve() 
              : new Promise<void>((resolve, reject) => {
                  const timeout = setTimeout(() => resolve(), 5000); // 5s timeout
                  img.onload = () => { clearTimeout(timeout); resolve(); };
                  img.onerror = () => { clearTimeout(timeout); resolve(); }; // Continue even if image fails
                })
          )
        );
        
        // Small delay to ensure rendering is complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (loadError) {
        console.warn('Error loading fonts/images:', loadError);
        // Continue with PDF generation even if some resources fail to load
      }

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${invoice.invoice_number || 'Invoice'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 800,
          windowHeight: clonedElement.scrollHeight + 100,
          removeContainer: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const, 
          compress: true 
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy'] as any,
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['.no-break', '.MuiCard-root', '.invoice-totals', 'tr'] as any
        }
      };

      await html2pdf().set(opt).from(clonedElement).save();
      setSuccessMessage('PDF generated and downloaded successfully');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setErrorMessage(
        err?.message || 'Failed to generate PDF. Please try again or use the Print option.'
      );
    } finally {
      // Cleanup cloned element
      const clonedElement = document.querySelector('.pdf-generating');
      if (clonedElement && clonedElement.parentNode) {
        clonedElement.parentNode.removeChild(clonedElement);
      }
      setPdfLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/invoices/${invoice.invoice_number}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-1000px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      alert('Invoice link copied to clipboard!');
    } catch {
      alert('Failed to copy link. Please copy manually: ' + link);
    }
  };

  const handleSendEmail = async (emailData: any) => {
    setEmailSending(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setEmailSending(false);
    setEmailSent(true);
    setTimeout(() => {
      setEmailDialogOpen(false);
      setEmailSent(false);
    }, 1500);
  };

  const calculateDaysUntilDue = (): number => {
    if (!invoice || !invoice.due_date) return 0;
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = calculateDaysUntilDue();
  const companyName = getConfigValue('company_name', 'Health Club Management System');

  const renderInvoiceContent = () => (
    <Box>
      <Box className="invoice-header" sx={{ position: 'relative' }}>
        {onClose && !previewMode && (
          <IconButton
            aria-label="Close"
            onClick={onClose}
            className="no-print"
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
          >
            <Cancel />
          </IconButton>
        )}
        <Box className="invoice-logo" sx={{ mb: 3 }}>
          {/* (Optional) Logo or Business Name */}
          <Typography variant="h4" fontWeight={700} color="primary">{companyName}</Typography>
        </Box>
        <Box className="invoice-header-details" sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>Invoice</Typography>
            <Typography variant="body2" color="text.secondary">{invoice.invoice_number}</Typography>
            <Typography variant="body2">Date: {formatDate(invoice.date)}</Typography>
            <Typography variant="body2">Due Date: {formatDate(invoice.due_date)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2">Bill to:</Typography>
            <Typography fontWeight={700}>{invoice.guest_name}</Typography>
            {invoice.guest_email && <Typography color="text.secondary">{invoice.guest_email}</Typography>}
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />
      </Box>
      <TableContainer className="invoice-table print-table">
        <Table>
          <TableHead>
            <TableRow sx={{ background: '#f5f5f5' }}>
              <TableCell>Description</TableCell>
              <TableCell align="center">Qty</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Tax</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>{item.product_name} {item.notes && <span style={{ color: '#888' }}>({item.notes})</span>}</TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                <TableCell align="right">{parseFloat(item.tax_rate).toFixed(1)}%</TableCell>
                <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box className="invoice-totals print-totals" sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ minWidth: 280 }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Subtotal:</Typography>
              <Typography variant="body2" fontWeight={600}>{formatCurrency(invoice.subtotal)}</Typography>
            </Box>
            {parseFloat(invoice.service_charge) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Service Charge:</Typography>
                <Typography variant="body2">{formatCurrency(invoice.service_charge)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Tax:</Typography>
              <Typography variant="body2">{formatCurrency(invoice.tax)}</Typography>
            </Box>
            {parseFloat(invoice.discount) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="success.main">Discount:</Typography>
                <Typography variant="body2" color="success.main">-{formatCurrency(invoice.discount)}</Typography>
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1" fontWeight={700}>Total:</Typography>
              <Typography variant="body1" fontWeight={700}>{formatCurrency(invoice.total)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Amount Paid:</Typography>
              <Typography variant="body2" color="success.main">{formatCurrency(invoice.amount_paid)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={700} color="primary.main">Balance Due:</Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">{formatCurrency(invoice.balance_due)}</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
      {invoice.notes && (
        <Box className="invoice-notes print-notes" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>Notes:</Typography>
          <Typography variant="body2">{invoice.notes}</Typography>
        </Box>
      )}
      <Box sx={{ mt: 4, textAlign: 'center', fontSize: 12, color: '#888' }}>
        Payment due within 30 days. Please include invoice number with payment.<br />Thank you for your business.
      </Box>
    </Box>
  );

  if (loading || !invoice) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (previewMode) {
    return (
      <Dialog 
        open 
        onClose={() => setPreviewMode(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility />
            <Typography variant="h6">Invoice Preview</Typography>
          </Box>
          <IconButton aria-label="Close" onClick={() => setPreviewMode(false)}>
            <Cancel />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
          <Box 
            sx={{ 
              backgroundColor: 'white',
              p: 4,
              borderRadius: 2,
              boxShadow: 3,
              maxWidth: '800px',
              mx: 'auto',
            }}
          >
            <Box id="printable-invoice" ref={printRef} className="invoice-box print-template">
              {renderInvoiceContent()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', gap: 1 }}>
          <Button onClick={() => setPreviewMode(false)} variant="outlined">
            Close
          </Button>
          <Button 
            onClick={handlePrint} 
            variant="contained" 
            startIcon={printLoading ? <CircularProgress size={16} /> : <Print />}
            disabled={printLoading}
          >
            {printLoading ? 'Printing...' : 'Print'}
          </Button>
          <Button 
            onClick={handleDownloadPDF} 
            variant="contained" 
            color="primary"
            startIcon={pdfLoading ? <CircularProgress size={16} /> : <Download />}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Generating...' : 'Download PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Can safely access invoice fields below
  const allowed = Array.isArray((invoice as any).allowed_actions) ? (invoice as any).allowed_actions as string[] : null;
  const balanceDue = parseFloat(String(invoice.balance_due));
  const amountPaid = parseFloat(String(invoice.amount_paid));
  const discountVal = parseFloat(String(invoice.discount));
  const invoiceCanPay = allowed ? allowed.includes('pay') : (['issued', 'pending', 'partial', 'overdue', 'draft'].includes(invoice.status) && balanceDue > 0 && !['paid', 'refunded', 'cancelled'].includes(invoice.status));
  const invoiceCanRefund = allowed ? allowed.includes('refund') : ((['paid', 'partial', 'overdue', 'cancelled'].includes(invoice.status)) && amountPaid > 0);
  const invoiceCanDeposit = allowed ? allowed.includes('collect_deposit') : ['issued', 'pending', 'partial', 'overdue', 'draft'].includes(invoice.status);
  const invoiceCanDiscount = allowed ? allowed.includes('discount') : (invoiceCanPay && discountVal === 0);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>

      {/* Action Bar - Hidden in print */}
      <Card sx={{ mb: 3 }} className="no-print">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                icon={getStatusIcon(invoice.status)}
                label={String(invoice.status).toUpperCase()}
                color={getStatusColor(invoice.status)}
                sx={{ fontWeight: 600, fontSize: '0.875rem' }}
              />
              {daysUntilDue > 0 && daysUntilDue <= 7 && invoice.status !== 'paid' && (
                <Chip
                  icon={<Warning />}
                  label={`Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              )}
              {daysUntilDue < 0 && invoice.status !== 'paid' && (
                <Chip
                  icon={<Warning />}
                  label={`Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`}
                  color="error"
                  size="small"
                />
              )}
            </Box>
            
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Tooltip title="Preview Invoice">
                <Button
                  variant="outlined"
                  startIcon={<Visibility />}
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  Preview
                </Button>
              </Tooltip>
              
              <Tooltip title="Email to Guest">
                <Button
                  variant="outlined"
                  startIcon={<Email />}
                  onClick={() => setEmailDialogOpen(true)}
                >
                  Email
                </Button>
              </Tooltip>
              
              <Tooltip title="Print Invoice">
                <Button
                  variant="outlined"
                  startIcon={printLoading ? <CircularProgress size={16} /> : <Print />}
                  onClick={handlePrint}
                  disabled={printLoading}
                >
                  {printLoading ? 'Printing...' : 'Print'}
                </Button>
              </Tooltip>
              
              <Tooltip title="Download as PDF">
                <Button
                  variant="outlined"
                  startIcon={pdfLoading ? <CircularProgress size={16} /> : <Download />}
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                >
                  {pdfLoading ? 'Generating...' : 'PDF'}
                </Button>
              </Tooltip>

              <Tooltip title="More Options">
                <IconButton onClick={(e: React.MouseEvent<HTMLButtonElement>) => setMenuAnchor(e.currentTarget)}>
                  <MoreVert />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* More Options Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { handleCopyLink(); setMenuAnchor(null); }}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          Copy Invoice Link
        </MenuItem>
        <MenuItem 
          onClick={() => { handleDownloadPDF(); setMenuAnchor(null); }}
          disabled={pdfLoading}
        >
          <ListItemIcon>
            {pdfLoading ? <CircularProgress size={16} /> : <Download fontSize="small" />}
          </ListItemIcon>
          {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
        </MenuItem>
        <MenuItem onClick={() => setMenuAnchor(null)}>
          <ListItemIcon><Share fontSize="small" /></ListItemIcon>
          Share Invoice
        </MenuItem>
      </Menu>

      {/* Printable Invoice Container */}
      <Box id="printable-invoice" ref={printRef} className="invoice-box print-template">
        {renderInvoiceContent()}
      </Box>

      {/* Tabs - Hidden in print */}
      <Box className="no-print" sx={{ mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab 
              value="payments" 
              label={
                <Badge badgeContent={invoice.payments.length} color="primary">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                    <AttachMoney fontSize="small" />
                    Payments
                  </Box>
                </Badge>
              }
            />
            <Tab 
              value="history" 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History fontSize="small" />
                  Activity
                </Box>
              }
            />
          </Tabs>
        </Box>

        {activeTab === 'payments' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Payment History
              </Typography>
              {invoice.payments.length > 0 ? (
                <List>
                  {invoice.payments.map((payment: any) => (
                    <ListItem
                      key={payment.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 2,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <PaymentIcon color="success" />
                              <Box>
                                <Typography variant="body1" fontWeight={600} component="span">
                                  {payment.payment_method_name || payment.method}
                                </Typography>
                                {payment.payment_type === 'deposit_application' && (
                                  <Chip 
                                    label="Deposit Applied" 
                                    size="small" 
                                    color="info" 
                                    variant="outlined"
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </Box>
                            </Box>
                            <Typography variant="h6" fontWeight={700} color="success.main" component="span">
                              +{formatCurrency(payment.amount)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block" color="text.secondary" component="span">
                              {(() => { const d = new Date(payment.payment_date); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); })()}
                            </Typography>
                            {payment.reference_number && (
                              <Typography variant="caption" display="block" color="text.secondary" component="span">
                                Reference: {payment.reference_number}
                              </Typography>
                            )}
                            {payment.transaction_id && (
                              <Typography variant="caption" display="block" color="text.secondary" component="span">
                                Transaction: {payment.transaction_id}
                              </Typography>
                            )}
                            {payment.notes && (
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                {payment.notes}
                              </Typography>
                            )}
                            {payment.processed_by_name && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                Processed by: {payment.processed_by_name}
                              </Typography>
                            )}
                          </Box>
                        }
                        primaryTypographyProps={{ component: 'span' }}
                        secondaryTypographyProps={{ component: 'span' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">No payments recorded yet</Alert>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Activity Log
              </Typography>
              <Alert severity="info">Activity history would be displayed here</Alert>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Quick Actions Card - Hidden in print */}
      {invoice.status !== 'cancelled' && (
        <Card sx={{ mt: 3 }} className="no-print">
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Quick Actions
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="large"
                startIcon={<PaymentIcon />}
                sx={{ minWidth: 180 }}
                disabled={!invoiceCanPay}
                onClick={() => setPaymentDialogOpen(true)}
              >
                Process Payment
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Undo />}
                sx={{ minWidth: 180 }}
                disabled={!invoiceCanRefund}
                onClick={() => setRefundDialogOpen(true)}
              >
                Process Refund
              </Button>
              <Button
                variant="outlined"
                color="info"
                startIcon={<AccountBalance />}
                sx={{ minWidth: 180 }}
                disabled={!invoiceCanDeposit}
                onClick={() => setDepositDialogOpen(true)}
              >
                Collect Deposit
              </Button>
              {invoiceCanDiscount && (
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<LocalOffer />}
                  sx={{ minWidth: 180 }}
                  onClick={() => setDiscountDialogOpen(true)}
                >
                  Apply Discount
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      <Dialog 
        open={emailDialogOpen} 
        onClose={() => !emailSending && setEmailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email />
            Send Invoice via Email
          </Box>
        </DialogTitle>
        <DialogContent>
          {!emailSent ? (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <TextField
                label="Recipient Email"
                type="email"
                defaultValue={invoice.guest_email}
                fullWidth
                disabled={emailSending}
              />
              <TextField
                label="Subject"
                defaultValue={`Invoice ${invoice.invoice_number} from Your Company`}
                fullWidth
                disabled={emailSending}
              />
              <TextField
                label="Message"
                multiline
                rows={4}
                defaultValue={`Dear ${invoice.guest_name},\n\nPlease find attached your invoice ${invoice.invoice_number} for the amount of ${formatCurrency(invoice.total)}.\n\nThank you for your business!`}
                fullWidth
                disabled={emailSending}
              />
              <Alert severity="info">
                Invoice will be attached as PDF
              </Alert>
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main">
                Email Sent Successfully!
              </Typography>
            </Box>
          )}
        </DialogContent>
        {!emailSent && (
          <DialogActions>
            <Button onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSendEmail({})} 
              variant="contained"
              disabled={emailSending}
              startIcon={emailSending ? <CircularProgress size={20} /> : <Email />}
            >
              {emailSending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        invoice={invoice}
        onPaymentProcessed={async () => { await refreshInvoice(); (onPaymentProcessed || (() => {}))(); setPaymentDialogOpen(false); }}
      />
      <RefundDialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        invoice={invoice}
        onRefundProcessed={async () => { await refreshInvoice(); setRefundDialogOpen(false); }}
      />
      <DepositDialog
        open={depositDialogOpen}
        onClose={() => setDepositDialogOpen(false)}
        invoice={invoice}
        onDepositCollected={async () => { await refreshInvoice(); setDepositDialogOpen(false); }}
      />
      <InvoiceDiscountDialog
        open={discountDialogOpen}
        onClose={() => setDiscountDialogOpen(false)}
        invoiceTotal={parseFloat(invoice.total)}
        onSubmit={async () => { await refreshInvoice(); setDiscountDialogOpen(false); }}
      />

      {/* Loading Backdrop for PDF Generation */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={pdfLoading}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography variant="h6">Generating PDF...</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Please wait while we create your invoice PDF
          </Typography>
        </Box>
      </Backdrop>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setErrorMessage(null)} 
          severity="error" 
          sx={{ width: '100%' }}
          icon={<ErrorIcon />}
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSuccessMessage(null)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default InvoiceDetails;