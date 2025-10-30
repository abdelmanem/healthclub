/**
 * Invoice Print & PDF Generation Handler
 * 
 * Fixes common issues with printing and PDF generation:
 * - Partial content in PDF
 * - Extra blank pages
 * - Content not fitting page
 * - Cut-off content
 */

import html2pdf from 'html2pdf.js';

/**
 * Enhanced Print Handler
 * Call this function when user clicks print button
 */
export const handlePrintInvoice = () => {
  // Store original title
  const originalTitle = document.title;
  
  // Get invoice number for filename
  const invoiceNumber = document.querySelector('[data-invoice-number]')?.textContent || 'Invoice';
  document.title = invoiceNumber;
  
  // Trigger print
  window.print();
  
  // Restore title after print dialog closes
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
};

/**
 * Enhanced PDF Generation with proper sizing
 * Fixes partial content and blank page issues
 */
export const handleDownloadPDF = async (invoiceNumber = 'Invoice') => {
  const element = document.getElementById('printable-invoice');
  
  if (!element) {
    console.error('Printable invoice element not found');
    return;
  }

  // Clone the element to avoid modifying the original
  const clonedElement = element.cloneNode(true);
  
  // Add PDF generation class
  clonedElement.classList.add('pdf-generating');
  
  // Remove no-print elements from clone
  clonedElement.querySelectorAll('.no-print').forEach(el => el.remove());
  
  // Show print-only elements
  clonedElement.querySelectorAll('.print-only').forEach(el => {
    el.style.display = 'block';
  });
  
  // Append clone to body (off-screen)
  clonedElement.style.position = 'absolute';
  clonedElement.style.left = '-9999px';
  clonedElement.style.top = '0';
  document.body.appendChild(clonedElement);

  // Configure PDF options
  const opt = {
    margin: [10, 10, 10, 10], // top, left, bottom, right in mm
    filename: `${invoiceNumber}.pdf`,
    image: { 
      type: 'jpeg', 
      quality: 0.98 
    },
    html2canvas: { 
      scale: 2, // Higher quality
      useCORS: true,
      letterRendering: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 800, // Fixed width for consistency
      windowHeight: element.scrollHeight + 100,
      removeContainer: false,
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: ['.no-break', '.MuiCard-root', '.invoice-totals', 'tr']
    }
  };

  try {
    // Generate PDF
    await html2pdf().set(opt).from(clonedElement).save();
    console.log('PDF generated successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again or use the Print option.');
  } finally {
    // Clean up - remove cloned element
    document.body.removeChild(clonedElement);
  }
};

/**
 * Alternative: Server-side PDF generation (Recommended for production)
 * This is more reliable and produces better quality PDFs
 */
export const handleDownloadPDFFromServer = async (invoiceId, invoiceNumber = 'Invoice') => {
  try {
    // Show loading state
    const loadingToast = showLoadingToast('Generating PDF...');
    
    // Call your backend API
    const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/pdf',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    // Get blob from response
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    // Hide loading
    hideLoadingToast(loadingToast);
    
    console.log('PDF downloaded successfully');
  } catch (error) {
    console.error('Error downloading PDF:', error);
    alert('Failed to download PDF. Please try again.');
  }
};

/**
 * Print preview functionality
 * Opens print dialog without actually printing
 */
export const handlePrintPreview = () => {
  window.print();
};

/**
 * Helper: Wait for images to load before generating PDF
 */
const waitForImagesToLoad = async (element) => {
  const images = element.querySelectorAll('img');
  const promises = Array.from(images).map(img => {
    return new Promise((resolve, reject) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = resolve;
        img.onerror = reject;
      }
    });
  });
  
  await Promise.all(promises);
};

/**
 * Improved PDF generation with image loading
 */
export const handleDownloadPDFWithImages = async (invoiceNumber = 'Invoice') => {
  const element = document.getElementById('printable-invoice');
  
  if (!element) {
    console.error('Printable invoice element not found');
    return;
  }

  try {
    // Wait for all images to load
    await waitForImagesToLoad(element);
    
    // Clone and prepare element
    const clonedElement = element.cloneNode(true);
    clonedElement.classList.add('pdf-generating');
    clonedElement.querySelectorAll('.no-print').forEach(el => el.remove());
    clonedElement.querySelectorAll('.print-only').forEach(el => {
      el.style.display = 'block';
    });
    
    // Append off-screen
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    document.body.appendChild(clonedElement);

    // Get actual height for better fitting
    const actualHeight = clonedElement.scrollHeight;
    const pageHeight = 297; // A4 height in mm
    const margin = 20; // Total margins
    const contentHeight = pageHeight - margin;
    const scale = Math.min(2, (contentHeight / (actualHeight * 0.264583))); // Convert px to mm

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: scale,
        useCORS: true,
        letterRendering: true,
        logging: false,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 800,
        windowHeight: actualHeight + 50,
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css'],
        avoid: '.no-break'
      }
    };

    await html2pdf().set(opt).from(clonedElement).save();
    
    // Cleanup
    document.body.removeChild(clonedElement);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};

/**
 * React Hook for Print & PDF functionality
 */
export const usePrintAndPDF = (invoiceNumber) => {
  const handlePrint = () => {
    handlePrintInvoice();
  };

  const handlePDF = async () => {
    await handleDownloadPDF(invoiceNumber);
  };

  const handleServerPDF = async (invoiceId) => {
    await handleDownloadPDFFromServer(invoiceId, invoiceNumber);
  };

  return {
    handlePrint,
    handlePDF,
    handleServerPDF,
  };
};

// Helper functions for loading toast (implement based on your UI library)
const showLoadingToast = (message) => {
  // Implement with your toast/snackbar library
  console.log(message);
  return Date.now();
};

const hideLoadingToast = (id) => {
  // Implement with your toast/snackbar library
  console.log('Hide toast', id);
};

/**
 * USAGE EXAMPLES:
 * 
 * // In your component:
 * import { handlePrintInvoice, handleDownloadPDF } from './invoicePrintHandler';
 * 
 * // For print:
 * <Button onClick={handlePrintInvoice}>Print</Button>
 * 
 * // For PDF:
 * <Button onClick={() => handleDownloadPDF(invoice.invoice_number)}>
 *   Download PDF
 * </Button>
 * 
 * // Using the hook:
 * const { handlePrint, handlePDF } = usePrintAndPDF(invoice.invoice_number);
 * <Button onClick={handlePrint}>Print</Button>
 * <Button onClick={handlePDF}>PDF</Button>
 */