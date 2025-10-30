/**
 * InvoiceDetails Component - Fixed Print & PDF Version
 * 
 * Key fixes:
 * 1. Proper HTML structure for printing
 * 2. No extra blank pages
 * 3. Complete content in PDF
 * 4. Fits on page properly
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Grid,
  // ... other imports
} from '@mui/material';
import { Print, Email, Download } from '@mui/icons-material';
import { handlePrintInvoice, handleDownloadPDF } from './invoicePrintHandler';

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({
  invoiceId,
  onClose,
  // ... other props
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ... existing state and effects

  // Enhanced PDF download handler
  const handlePDFDownload = async () => {
    if (!invoice) return;
    
    setPdfLoading(true);
    try {
      await handleDownloadPDF(invoice.invoice_number);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Action Bar - Hidden in print */}
      <Card className="no-print" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={handlePrintInvoice}
            >
              Print
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handlePDFDownload}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Email />}
              onClick={handleSendEmail}
            >
              Email
            </Button>
            {onClose && (
              <Button onClick={onClose}>Close</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Printable Invoice Container */}
      <Box id="printable-invoice">
        
        {/* Company Header - Print friendly */}
        <Card className="no-break">
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={3} className="invoice-header">
              {/* Company Info */}
              <Grid item xs={12} md={6}>
                <Box className="invoice-logo">
                  <Typography variant="h4" fontWeight={700} color="primary">
                    Your Company Name
                  </Typography>
                </Box>
                <Box className="invoice-header-details" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    123 Business Street
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    City, State 12345
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Phone: (555) 123-4567
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Email: billing@company.com
                  </Typography>
                </Box>
              </Grid>

              {/* Invoice Number & Status */}
              <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Typography variant="h3" fontWeight={700} gutterBottom>
                  INVOICE
                </Typography>
                <Typography 
                  variant="h5" 
                  color="primary" 
                  gutterBottom
                  data-invoice-number
                >
                  {invoice?.invoice_number}
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: getStatusColor(invoice?.status)
                  }}
                  className="print-chip"
                >
                  {invoice?.status}
                </Typography>
              </Grid>
            </Grid>

            {/* Bill To & Invoice Details */}
            <Grid container spacing={4} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
                  Bill To
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="h6" fontWeight={600}>
                    {invoice?.guest_name}
                  </Typography>
                  {invoice?.guest_email && (
                    <Typography variant="body2" color="text.secondary">
                      {invoice.guest_email}
                    </Typography>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Invoice Date:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(invoice?.date)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Due Date:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(invoice?.due_date)}
                    </Typography>
                  </Box>
                  {invoice?.reservation_id && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Reservation:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        #{invoice.reservation_id}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Line Items Table */}
        <Card className="no-break invoice-table" sx={{ mt: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Tax</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {item.product_name}
                      </Typography>
                      {item.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {item.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell align="right">{parseFloat(item.tax_rate).toFixed(1)}%</TableCell>
                    <TableCell align="right">{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals Section */}
            <Box className="invoice-totals no-break" sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 350 }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1">Subtotal:</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {formatCurrency(invoice?.subtotal)}
                    </Typography>
                  </Box>
                  
                  {parseFloat(invoice?.service_charge || '0') > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1">Service Charge:</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {formatCurrency(invoice?.service_charge)}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1">Tax:</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {formatCurrency(invoice?.tax)}
                    </Typography>
                  </Box>
                  
                  {parseFloat(invoice?.discount || '0') > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" color="success.main">
                        Discount:
                      </Typography>
                      <Typography variant="body1" fontWeight={600} color="success.main">
                        -{formatCurrency(invoice?.discount)}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      borderTop: 2,
                      borderColor: 'divider',
                      pt: 1.5,
                      mt: 1
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>Total:</Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {formatCurrency(invoice?.total)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" color="text.secondary">
                      Amount Paid:
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {formatCurrency(invoice?.amount_paid)}
                    </Typography>
                  </Box>
                  
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      bgcolor: parseFloat(invoice?.balance_due || '0') > 0 ? 'error.light' : 'success.light',
                      p: 2,
                      borderRadius: 1,
                      mt: 1
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>
                      Balance Due:
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {formatCurrency(invoice?.balance_due)}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice?.notes && (
          <Card className="no-break invoice-notes" sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Notes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {invoice.notes}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Payment Terms - Print Only */}
        <Card className="print-only no-break print-notes" sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Payment Terms
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Payment is due within 30 days. Please include the invoice number with your payment.
              For questions about this invoice, please contact us at billing@company.com.
            </Typography>
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Thank you for your business!
              </Typography>
            </Box>
          </CardContent>
        </Card>

      </Box>
      {/* End Printable Invoice */}

      {/* Tabs and other content - Hidden in print */}
      <Box className="no-print" sx={{ mt: 3 }}>
        {/* Your existing tabs, payment history, actions, etc. */}
      </Box>

    </Box>
  );
};

// Helper functions
const formatCurrency = (amount: string | undefined) => {
  if (!amount) return '$0.00';
  return `$${parseFloat(amount).toFixed(2)}`;
};

const formatDate = (date: string | undefined) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getStatusColor = (status: string | undefined) => {
  const colors = {
    paid: '#4caf50',
    partial: '#ff9800',
    pending: '#ff9800',
    overdue: '#f44336',
    cancelled: '#9e9e9e',
  };
  return colors[status as keyof typeof colors] || '#000';
};