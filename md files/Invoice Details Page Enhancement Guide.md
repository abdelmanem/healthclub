# Invoice Details Page Enhancement Guide

## Key Improvements to Implement

### 1. **Visual & UX Enhancements**

#### Status Indicators
```jsx
// Add visual status bar at top with icons
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Chip
    icon={<CheckCircle />} // Use appropriate icon per status
    label={invoice.status.toUpperCase()}
    color={getStatusColor(invoice.status)}
    size="large"
    sx={{ fontWeight: 600, fontSize: '1rem' }}
  />
  
  {/* Add urgency indicators */}
  {daysUntilDue > 0 && daysUntilDue <= 7 && (
    <Chip
      icon={<Warning />}
      label={`Due in ${daysUntilDue} days`}
      color="warning"
      variant="outlined"
    />
  )}
</Box>
```

#### Improved Layout
- Use 4:8 grid ratio for better visual hierarchy
- Add company logo/branding section at top
- Increase padding and spacing (use `p: 4` instead of default)
- Add subtle hover effects on interactive elements
- Use colored backgrounds for totals sections

### 2. **Print Optimization**

#### Add Print Styles
```jsx
// Add to component
<style>{`
  @media print {
    /* Hide non-essential elements */
    .no-print {
      display: none !important;
    }
    
    /* Show print-only elements */
    .print-only {
      display: block !important;
    }
    
    /* Isolate printable content */
    body * {
      visibility: hidden;
    }
    #printable-invoice, #printable-invoice * {
      visibility: visible;
    }
    #printable-invoice {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      background: white;
    }
    
    /* Optimize for print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Page breaks */
    .page-break {
      page-break-before: always;
    }
    
    /* Remove shadows and borders */
    .MuiCard-root {
      box-shadow: none !important;
      border: 1px solid #ddd !important;
    }
  }
  
  .print-only {
    display: none;
  }
`}</style>
```

#### Wrap Printable Content
```jsx
<Box id="printable-invoice">
  {/* All invoice content here */}
  
  {/* Add print-only sections */}
  <Box className="print-only">
    <Typography variant="h6">Payment Terms</Typography>
    <Typography>
      Payment due within 30 days. Include invoice number with payment.
    </Typography>
  </Box>
</Box>
```

### 3. **Email Functionality Enhancement**

#### Create Email Dialog Component
```jsx
const [emailDialogOpen, setEmailDialogOpen] = useState(false);
const [emailSending, setEmailSending] = useState(false);
const [emailSuccess, setEmailSuccess] = useState(false);

// Email Dialog
<Dialog open={emailDialogOpen} maxWidth="sm" fullWidth>
  <DialogTitle>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Email />
      Send Invoice via Email
    </Box>
  </DialogTitle>
  <DialogContent>
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
        defaultValue={`Invoice ${invoice.invoice_number}`}
        fullWidth
        disabled={emailSending}
      />
      <TextField
        label="Message"
        multiline
        rows={6}
        defaultValue={generateEmailTemplate()}
        fullWidth
        disabled={emailSending}
      />
      <TextField
        label="CC (optional)"
        type="email"
        placeholder="additional@email.com"
        fullWidth
        disabled={emailSending}
      />
      
      {/* Attachment preview */}
      <Alert severity="info" icon={<AttachFile />}>
        Invoice will be attached as PDF ({invoice.invoice_number}.pdf)
      </Alert>
      
      {/* Send options */}
      <FormControlLabel
        control={<Checkbox defaultChecked />}
        label="Send me a copy"
      />
    </Stack>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setEmailDialogOpen(false)}>
      Cancel
    </Button>
    <Button 
      onClick={handleSendEmail} 
      variant="contained"
      disabled={emailSending}
      startIcon={emailSending ? <CircularProgress size={20} /> : <Email />}
    >
      {emailSending ? 'Sending...' : 'Send Email'}
    </Button>
  </DialogActions>
</Dialog>
```

#### Email Template Generator
```jsx
const generateEmailTemplate = () => {
  return `Dear ${invoice.guest_name},

Thank you for your business. Please find attached your invoice.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Amount Due: ${formatCurrency(invoice.balance_due)}
- Due Date: ${formatDate(invoice.due_date)}

If you have any questions, please don't hesitate to contact us.

Best regards,
Your Company Name`;
};
```

### 4. **PDF Generation**

#### Option A: Client-Side PDF (html2pdf.js)
```jsx
// Add to imports (via CDN)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js">

const handleDownloadPDF = async () => {
  setActionLoading(true);
  try {
    const element = document.getElementById('printable-invoice');
    const opt = {
      margin: 10,
      filename: `${invoice.invoice_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    await html2pdf().set(opt).from(element).save();
    showSnackbar('PDF downloaded successfully', 'success');
  } catch (error) {
    showSnackbar('Failed to generate PDF', 'error');
  } finally {
    setActionLoading(false);
  }
};
```

#### Option B: Server-Side PDF (Recommended)
```jsx
const handleDownloadPDF = async () => {
  setActionLoading(true);
  try {
    // Request PDF from backend
    const response = await invoicesService.downloadPDF(invoice.id);
    
    // Create blob and download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoice_number}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    showSnackbar('PDF downloaded successfully', 'success');
  } catch (error) {
    handleApiError(error, showSnackbar);
  } finally {
    setActionLoading(false);
  }
};
```

### 5. **Additional Features**

#### Action Bar with More Options
```jsx
<Stack direction="row" spacing={1}>
  {/* Primary actions */}
  <Button variant="outlined" startIcon={<Visibility />}>
    Preview
  </Button>
  <Button variant="outlined" startIcon={<Email />}>
    Email
  </Button>
  <Button variant="outlined" startIcon={<Print />}>
    Print
  </Button>
  <Button variant="outlined" startIcon={<Download />}>
    PDF
  </Button>
  
  {/* More options menu */}
  <IconButton onClick={handleMenuOpen}>
    <MoreVert />
  </IconButton>
</Stack>

<Menu anchorEl={anchorEl} open={Boolean(anchorEl)}>
  <MenuItem onClick={handleCopyLink}>
    <ListItemIcon><ContentCopy /></ListItemIcon>
    Copy Invoice Link
  </MenuItem>
  <MenuItem onClick={handleShare}>
    <ListItemIcon><Share /></ListItemIcon>
    Share Invoice
  </MenuItem>
  <MenuItem onClick={handleDuplicate}>
    <ListItemIcon><FileCopy /></ListItemIcon>
    Duplicate Invoice
  </MenuItem>
  <Divider />
  <MenuItem onClick={handleExportCSV}>
    <ListItemIcon><Download /></ListItemIcon>
    Export as CSV
  </MenuItem>
</Menu>
```

#### Copy Link Functionality
```jsx
const handleCopyLink = () => {
  const link = `${window.location.origin}/invoices/${invoice.invoice_number}`;
  navigator.clipboard.writeText(link);
  showSnackbar('Invoice link copied to clipboard', 'success');
};
```

#### Preview Mode
```jsx
const [previewMode, setPreviewMode] = useState(false);

// Toggle preview
<Button 
  variant={previewMode ? 'contained' : 'outlined'}
  startIcon={<Visibility />}
  onClick={() => setPreviewMode(!previewMode)}
>
  {previewMode ? 'Exit Preview' : 'Preview'}
</Button>

// Apply preview styles
<Box sx={{
  ...(previewMode && {
    maxWidth: 800,
    mx: 'auto',
    boxShadow: 3,
    bgcolor: 'background.paper'
  })
}}>
```

### 6. **Visual Improvements**

#### Better Totals Section
```jsx
<Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
  <Box sx={{ minWidth: 400 }}>
    <Stack spacing={2}>
      {/* Regular items */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body1">Subtotal:</Typography>
        <Typography variant="body1" fontWeight={600}>
          {formatCurrency(invoice.subtotal)}
        </Typography>
      </Box>
      
      {/* Total with highlight */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        bgcolor: 'primary.light',
        p: 2,
        borderRadius: 1
      }}>
        <Typography variant="h6" fontWeight={700}>Total:</Typography>
        <Typography variant="h6" fontWeight={700}>
          {formatCurrency(invoice.total)}
        </Typography>
      </Box>
      
      {/* Balance with color coding */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        bgcolor: parseFloat(invoice.balance_due) > 0 ? 'error.light' : 'success.light',
        p: 2,
        borderRadius: 1
      }}>
        <Typography variant="h6" fontWeight={700}>Balance Due:</Typography>
        <Typography variant="h6" fontWeight={700}>
          {formatCurrency(invoice.balance_due)}
        </Typography>
      </Box>
    </Stack>
  </Box>
</Box>
```

#### Enhanced Line Items
```jsx
<TableRow 
  sx={{
    '&:hover': { bgcolor: 'action.hover' },
    transition: 'background-color 0.2s'
  }}
>
  <TableCell>
    <Box>
      <Typography variant="body2" fontWeight={600}>
        {item.product_name}
      </Typography>
      {item.notes && (
        <Typography variant="caption" color="text.secondary" display="block">
          {item.notes}
        </Typography>
      )}
      {/* Add visual badges */}
      {isDeposit && (
        <Chip 
          label="Deposit" 
          size="small" 
          color="success" 
          variant="outlined"
          sx={{ mt: 0.5 }}
        />
      )}
    </Box>
  </TableCell>
  {/* Rest of cells */}
</TableRow>
```

### 7. **Payment History Enhancement**

```jsx
<List>
  {invoice.payments.map((payment) => (
    <ListItem
      key={payment.id}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        mb: 2,
        '&:hover': { 
          bgcolor: 'action.hover',
          boxShadow: 2
        },
        transition: 'all 0.2s'
      }}
    >
      <ListItemIcon>
        <PaymentIcon color="success" fontSize="large" />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {payment.payment_method_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(payment.payment_date)}
              </Typography>
            </Box>
            <Typography variant="h6" fontWeight={700} color="success.main">
              +{formatCurrency(payment.amount)}
            </Typography>
          </Box>
        }
        secondary={/* Details */}
      />
    </ListItem>
  ))}
</List>
```

### 8. **Responsive Design**

```jsx
// Stack actions on mobile
<Stack 
  direction={{ xs: 'column', sm: 'row' }} 
  spacing={2} 
  sx={{ width: { xs: '100%', sm: 'auto' } }}
>
  <Button fullWidth={{ xs: true, sm: false }}>Action</Button>
</Stack>

// Adjust grid for mobile
<Grid container spacing={{ xs: 2, md: 3 }}>
  <Grid item xs={12} md={6}>
    {/* Content */}
  </Grid>
</Grid>
```

### 9. **Loading States**

```jsx
// Skeleton loading for better UX
{loading ? (
  <>
    <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" height={400} sx={{ mb: 2 }} />
  </>
) : (
  /* Content */
)}
```

### 10. **Success Feedback**

```jsx
// Show success animation after email sent
{emailSuccess && (
  <Box sx={{ textAlign: 'center', py: 4 }}>
    <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
    <Typography variant="h6" color="success.main">
      Email Sent Successfully!
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Invoice has been sent to {invoice.guest_email}
    </Typography>
  </Box>
)}
```

## Implementation Priority

1. **High Priority**
   - Print styles optimization
   - Email dialog with template
   - PDF download (server-side)
   - Visual improvements (spacing, colors, hierarchy)

2. **Medium Priority**
   - Preview mode
   - Copy link functionality
   - Enhanced payment history
   - More options menu

3. **Nice to Have**
   - Share functionality
   - Activity log/audit trail
   - Export options (CSV, Excel)
   - Duplicate invoice feature

## Testing Checklist

- [ ] Print preview looks professional
- [ ] PDF generates correctly with all formatting
- [ ] Email sends with proper template
- [ ] Mobile responsive (all screen sizes)
- [ ] All action buttons work
- [ ] Loading states display properly
- [ ] Error handling works
- [ ] Print doesn't include action buttons
- [ ] Colors print correctly
- [ ] Page breaks work in multi-page invoices
