# Invoice Print & PDF Troubleshooting Guide

## 🔴 Common Issues & Solutions

### Issue 1: PDF Shows Only Partial Content

**Causes:**
- Element is larger than PDF canvas
- Incorrect window/scroll dimensions in html2canvas
- Content is being clipped

**Solutions:**

```javascript
// WRONG - This causes partial content:
const opt = {
  html2canvas: { 
    windowWidth: document.body.scrollWidth,
    windowHeight: document.body.scrollHeight  // Too large!
  }
};

// CORRECT - Fixed dimensions:
const opt = {
  html2canvas: { 
    scale: 2,
    windowWidth: 800,  // Fixed width
    windowHeight: element.scrollHeight + 100,  // Content height only
    scrollY: 0,
    scrollX: 0
  }
};
```

### Issue 2: Extra Blank Pages When Printing

**Causes:**
- Overflow content creating phantom pages
- Large margins pushing content to next page
- Hidden elements still taking up space
- MUI's transform/position styles breaking layout

**Solutions:**

```css
/* CRITICAL: Reset positioning */
@media print {
  * {
    position: static !important;
    transform: none !important;
    overflow: visible !important;
  }
  
  /* Remove all margins/padding that create space */
  body, html {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
  }
  
  /* Hide properly, not just visibility */
  .no-print {
    display: none !important; /* Not just visibility: hidden */
  }
  
  /* Prevent page breaks */
  .no-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
```

### Issue 3: Content Doesn't Fit on Page

**Causes:**
- Fixed widths too large for print
- Padding/margins too generous
- Font sizes not optimized for print

**Solutions:**

```css
@media print {
  /* Scale down if needed */
  #printable-invoice {
    transform: scale(0.95);
    transform-origin: top left;
  }
  
  /* Or adjust specific elements */
  table {
    font-size: 11px !important;
  }
  
  .MuiCardContent-root {
    padding: 12px !important; /* Reduce padding */
  }
  
  /* Use @page for margins */
  @page {
    size: A4 portrait;
    margin: 15mm 10mm; /* Reasonable margins */
  }
}
```

## ✅ Step-by-Step Fix Checklist

### Step 1: Fix HTML Structure

```tsx
// WRONG - Everything in body
<Box>
  <Button>Print</Button>
  <Card>Invoice content</Card>
  <Tabs>...</Tabs>
</Box>

// CORRECT - Separate printable content
<Box>
  {/* Non-printable */}
  <Box className="no-print">
    <Button>Print</Button>
  </Box>
  
  {/* Printable only */}
  <Box id="printable-invoice">
    <Card className="no-break">
      Invoice content
    </Card>
  </Box>
  
  {/* Non-printable */}
  <Box className="no-print">
    <Tabs>...</Tabs>
  </Box>
</Box>
```

### Step 2: Add Print CSS

```css
/* Add this to your global CSS or component */
@media print {
  /* Hide everything first */
  body * {
    visibility: hidden !important;
  }
  
  /* Show only printable */
  #printable-invoice,
  #printable-invoice * {
    visibility: visible !important;
  }
  
  /* Position at top */
  #printable-invoice {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
  }
  
  /* Remove MUI styles */
  .MuiBox-root,
  .MuiCard-root {
    box-shadow: none !important;
    transform: none !important;
  }
  
  /* Hide buttons */
  button,
  .MuiButton-root,
  .MuiIconButton-root,
  .no-print {
    display: none !important;
  }
}
```

### Step 3: Fix Print Handler

```javascript
// Simple and reliable
export const handlePrint = () => {
  window.print();
};

// Don't do complex cloning or manipulation
// Let CSS handle everything
```

### Step 4: Fix PDF Generation

```javascript
export const handleDownloadPDF = async (invoiceNumber) => {
  const element = document.getElementById('printable-invoice');
  
  // Clone to avoid affecting original
  const clone = element.cloneNode(true);
  clone.classList.add('pdf-generating');
  
  // Remove no-print elements
  clone.querySelectorAll('.no-print').forEach(el => el.remove());
  
  // Add to body (hidden)
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  document.body.appendChild(clone);
  
  const opt = {
    margin: 10,
    filename: `${invoiceNumber}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      windowWidth: 800,
      windowHeight: clone.scrollHeight + 50,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: {
      mode: ['avoid-all', 'css'],
      avoid: '.no-break'
    }
  };
  
  await html2pdf().set(opt).from(clone).save();
  
  // Cleanup
  document.body.removeChild(clone);
};
```

## 🎯 Quick Fixes for Specific Problems

### Problem: "PDF is cut off at bottom"

```javascript
// Add extra padding to height
html2canvas: {
  windowHeight: element.scrollHeight + 100, // Add buffer
}
```

### Problem: "Table rows split across pages"

```css
@media print {
  tr, .MuiTableRow-root {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
```

### Problem: "Colors don't show in print/PDF"

```css
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
}
```

### Problem: "MUI components look broken in print"

```css
@media print {
  /* Reset all MUI positioning */
  .MuiBox-root,
  .MuiPaper-root,
  .MuiCard-root {
    position: static !important;
    transform: none !important;
    box-shadow: none !important;
  }
  
  /* Fix Grid */
  .MuiGrid-container {
    display: block !important;
  }
  
  .MuiGrid-item {
    width: 100% !important;
    max-width: 100% !important;
  }
}
```

## 🚀 Best Practices

### 1. Keep Printable Content Separate
```tsx
// Bad
<Card>
  <Button>Print</Button>
  <Typography>Content</Typography>
</Card>

// Good
<>
  <Card className="no-print">
    <Button>Print</Button>
  </Card>
  <Card id="printable-invoice">
    <Typography>Content</Typography>
  </Card>
</>
```

### 2. Use Classes, Not Inline Styles
```tsx
// Bad - Harder to override
<Box sx={{ display: 'flex' }}>

// Good - Easy to control with @media print
<Box className="action-bar no-print">
```

### 3. Test Early and Often
- Test in Chrome (Cmd/Ctrl + P)
- Test in different browsers
- Test actual printing (not just preview)
- Test PDF generation with different content lengths

### 4. Use Server-Side PDF for Production
Client-side PDF generation is convenient but has limitations. For production:

```javascript
// Backend (Python example)
from weasyprint import HTML

def generate_invoice_pdf(invoice_id):
    html = render_template('invoice.html', invoice=invoice)
    pdf = HTML(string=html).write_pdf()
    return pdf

// Frontend
const response = await fetch(`/api/invoices/${id}/pdf`);
const blob = await response.blob();
// Download blob
```

## 📋 Testing Checklist

- [ ] Print preview shows complete content
- [ ] No extra blank pages
- [ ] Action buttons are hidden
- [ ] Tabs/dialogs are hidden
- [ ] Company logo appears
- [ ] Tables don't split awkwardly
- [ ] Colors print correctly
- [ ] PDF contains all content
- [ ] PDF is single page (if invoice is short)
- [ ] PDF filename is correct
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Mobile print works

## 🔧 Debug Tips

### Enable Print Debug Mode

```css
/* Add this temporarily to see what's being printed */
@media print {
  * {
    border: 1px solid red !important;
  }
  
  #printable-invoice {
    border: 3px solid green !important;
  }
}
```

### Console Logging for PDF

```javascript
const opt = {
  html2canvas: {
    logging: true, // Enable to see what's being captured
  }
};
```

### Measure Content Height

```javascript
const element = document.getElementById('printable-invoice');
console.log('Element height:', element.scrollHeight);
console.log('Element width:', element.scrollWidth);
console.log('Viewport:', window.innerWidth, window.innerHeight);
```

## 📚 Additional Resources

- [MDN: Printing](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print)
- [html2pdf.js Documentation](https://github.com/eKoopmans/html2pdf.js)
- [CSS Paged Media](https://www.w3.org/TR/css-page-3/)
- [WeasyPrint (Server-side)](https://weasyprint.org/)

## ⚡ Quick Copy-Paste Solutions

### Complete Print CSS
See the "Fixed Print & PDF Invoice Component" artifact

### Complete Print Handler
See the "Invoice Print & PDF Handler" artifact

### Complete Component Integration
See the "InvoiceDetails with Fixed Print/PDF" artifact
