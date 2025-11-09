"""
PDF generation utility for invoices using reportlab
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from decimal import Decimal
from config.utils import get_config


def generate_invoice_pdf(invoice):
    """
    Generate a PDF for an invoice using reportlab
    
    Args:
        invoice: Invoice model instance
        
    Returns:
        BytesIO: PDF file as bytes
    """
    # Get currency configuration - check multiple keys like frontend does
    currency_code = (
        get_config('system_currency_code') or
        get_config('system_currency') or
        get_config('default_currency') or
        get_config('currency_code') or
        get_config('currency') or
        None
    )
    
    currency_symbol = (
        get_config('system_currency_symbol') or
        get_config('currency_symbol') or
        get_config('currency.sign') or
        None
    )
    
    # If currency_code is set but not a valid ISO code (like "LE"), use it as symbol
    # Valid ISO currency codes are 3 letters (USD, EUR, EGP, LBP, etc.)
    # If it's 2 letters or not standard, treat it as a symbol
    final_symbol = currency_symbol
    if currency_code:
        # Check if it looks like a valid ISO currency code (3 uppercase letters)
        if len(currency_code) == 3 and currency_code.isupper() and currency_code.isalpha():
            # It's a valid ISO code, but we still need a symbol for PDF
            # Try to get symbol from config, or use the code as fallback
            if not final_symbol:
                # For common currencies, map code to symbol
                currency_map = {
                    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
                    'EGP': 'E£', 'LBP': 'L£', 'SAR': '﷼', 'AED': 'د.إ',
                }
                final_symbol = currency_map.get(currency_code, currency_code)
        else:
            # Not a valid ISO code, treat it as a symbol (e.g., "LE", "L.E.")
            final_symbol = currency_code
    
    # Final fallback
    if not final_symbol:
        final_symbol = '$'
    
    def format_currency(amount):
        """Format currency amount with configured symbol"""
        try:
            amount_float = float(amount)
            return f"{final_symbol}{amount_float:.2f}"
        except (ValueError, TypeError):
            return f"{final_symbol}0.00"
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
                           leftMargin=15*mm, rightMargin=15*mm)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#3f51b5'),
        spaceAfter=20,
        alignment=TA_LEFT,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=12,
    )
    
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#333333'),
    )
    
    # Company name
    company_name = "Health Club Management System"
    elements.append(Paragraph(company_name, title_style))
    elements.append(Spacer(1, 12*mm))
    
    # Format dates
    invoice_date_str = ''
    if invoice.date:
        try:
            if hasattr(invoice.date, 'date'):
                invoice_date_str = invoice.date.date().strftime('%b %d, %Y')
            elif hasattr(invoice.date, 'strftime'):
                invoice_date_str = invoice.date.strftime('%b %d, %Y')
            else:
                invoice_date_str = str(invoice.date)
        except (AttributeError, ValueError):
            invoice_date_str = str(invoice.date)
    
    due_date_str = ''
    if invoice.due_date:
        try:
            if hasattr(invoice.due_date, 'strftime'):
                due_date_str = invoice.due_date.strftime('%b %d, %Y')
            else:
                due_date_str = str(invoice.due_date)
        except (AttributeError, ValueError):
            due_date_str = str(invoice.due_date)
    
    # Guest info
    guest_name = f"{invoice.guest.first_name} {invoice.guest.last_name}" if invoice.guest else "N/A"
    guest_email = invoice.guest.email if invoice.guest and invoice.guest.email else ""
    
    # Header table styles
    invoice_label_style = ParagraphStyle(
        'InvoiceLabel',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#333333'),
    )
    
    bill_to_label_style = ParagraphStyle(
        'BillToLabel',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#333333'),
        alignment=TA_RIGHT,
    )
    
    # Header table
    header_data = [
        [
            Paragraph('Invoice', invoice_label_style),
            Paragraph('Bill to:', bill_to_label_style)
        ],
        [
            Paragraph(invoice.invoice_number or 'N/A', invoice_label_style),
            Paragraph(guest_name, bill_to_label_style)
        ],
        [
            Paragraph(f'Date: {invoice_date_str}', invoice_label_style),
            Paragraph(guest_email if guest_email else '', bill_to_label_style)
        ],
        [
            Paragraph(f'Due Date: {due_date_str}', invoice_label_style),
            Paragraph('', bill_to_label_style)
        ],
    ]
    
    header_table = Table(header_data, colWidths=[90*mm, 90*mm])
    header_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 12*mm))
    
    # Items table
    items_data = [['Description', 'Qty', 'Unit Price', 'Tax %', 'Total']]
    
    for item in invoice.items.all():
        description = item.product_name or 'N/A'
        if hasattr(item, 'notes') and item.notes:
            description += f" ({item.notes})"
        
        try:
            line_total = float(item.line_total)
        except (AttributeError, TypeError, ValueError):
            line_total = float(item.unit_price) * int(item.quantity)
        
        items_data.append([
            description,
            str(item.quantity),
            format_currency(item.unit_price),
            f"{float(item.tax_rate):.1f}%",
            format_currency(line_total),
        ])
    
    items_table = Table(items_data, colWidths=[80*mm, 20*mm, 25*mm, 20*mm, 25*mm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (-1, 0), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 10*mm))
    
    # Totals section - MATCH SCREENSHOT EXACTLY
    # Regular label and value (Subtotal, Tax)
    totals_label_style = ParagraphStyle(
        'TotalsLabel',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#333333'),  # Black for labels
    )
    
    totals_value_style = ParagraphStyle(
        'TotalsValue',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#333333'),  # Black for values
    )
    
    # Total - BOLD BLACK
    total_label_bold = ParagraphStyle(
        'TotalLabelBold',
        parent=normal_style,
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#333333'),  # Bold black
    )
    
    total_value_bold = ParagraphStyle(
        'TotalValueBold',
        parent=normal_style,
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#333333'),  # Bold black
    )
    
    # Amount Paid - REGULAR LABEL, GREEN VALUE
    amount_paid_label_style = ParagraphStyle(
        'AmountPaidLabel',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#333333'),  # Black label
    )
    
    amount_paid_value_style = ParagraphStyle(
        'AmountPaidValue',
        parent=normal_style,
        fontSize=10,
        textColor=colors.HexColor('#4caf50'),  # Green value
    )
    
    # Balance Due - BOLD BLUE (BOTH LABEL AND VALUE)
    balance_due_label_bold = ParagraphStyle(
        'BalanceDueLabelBold',
        parent=normal_style,
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1976d2'),  # Bold blue
    )
    
    balance_due_value_bold = ParagraphStyle(
        'BalanceDueValueBold',
        parent=normal_style,
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1976d2'),  # Bold blue
    )
    
    # Build totals data
    totals_data = []
    totals_data.append([
        Paragraph('Subtotal:', totals_label_style), 
        Paragraph(format_currency(invoice.subtotal), totals_value_style)
    ])
    
    service_charge_val = Decimal(str(invoice.service_charge)) if invoice.service_charge else Decimal('0.00')
    if service_charge_val > 0:
        totals_data.append([
            Paragraph('Service Charge:', totals_label_style), 
            Paragraph(format_currency(service_charge_val), totals_value_style)
        ])
    
    totals_data.append([
        Paragraph('Tax:', totals_label_style), 
        Paragraph(format_currency(invoice.tax), totals_value_style)
    ])
    
    discount_val = Decimal(str(invoice.discount)) if invoice.discount else Decimal('0.00')
    if discount_val > 0:
        discount_label_style = ParagraphStyle(
            'DiscountLabel',
            parent=normal_style,
            fontSize=10,
            textColor=colors.HexColor('#333333'),  # Black label
        )
        discount_value_style = ParagraphStyle(
            'DiscountValue',
            parent=normal_style,
            fontSize=10,
            textColor=colors.HexColor('#4caf50'),  # Green value
        )
        totals_data.append([
            Paragraph('Discount:', discount_label_style), 
            Paragraph(f"-{format_currency(discount_val)}", discount_value_style)
        ])
    
    # Spacer row
    totals_data.append([Paragraph('', normal_style), Paragraph('', normal_style)])
    
    # Total - BOLD BLACK
    totals_data.append([
        Paragraph('Total:', total_label_bold),
        Paragraph(format_currency(invoice.total), total_value_bold)
    ])
    
    # Amount Paid - BLACK LABEL, GREEN VALUE
    totals_data.append([
        Paragraph('Amount Paid:', amount_paid_label_style),
        Paragraph(format_currency(invoice.amount_paid), amount_paid_value_style)
    ])
    
    # Balance Due - BOLD BLUE
    totals_data.append([
        Paragraph('Balance Due:', balance_due_label_bold),
        Paragraph(format_currency(invoice.balance_due), balance_due_value_bold)
    ])
    
    # Find row indices for lines
    num_rows = len(totals_data)
    total_row_idx = num_rows - 3  # Total row
    balance_due_row_idx = num_rows - 1  # Balance Due row
    
    # Create table with proper column widths for spacing
    totals_table = Table(totals_data, colWidths=[130*mm, 40*mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),  # Labels right-aligned
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),  # Values right-aligned
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (0, -1), 8),   # Left padding for labels
        ('RIGHTPADDING', (0, 0), (0, -1), 20),  # More right padding for labels (creates space)
        ('LEFTPADDING', (1, 0), (1, -1), 10),   # Left padding for values
        ('RIGHTPADDING', (1, 0), (1, -1), 8),   # Right padding for values
        ('LINEABOVE', (0, total_row_idx), (-1, total_row_idx), 1.5, colors.HexColor('#333333')),
        ('LINEABOVE', (0, balance_due_row_idx), (-1, balance_due_row_idx), 1, colors.HexColor('#cccccc')),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10*mm))
    
    # Notes
    if invoice.notes:
        elements.append(Paragraph('<b>Notes:</b>', heading_style))
        elements.append(Paragraph(invoice.notes, normal_style))
        elements.append(Spacer(1, 8*mm))
    
    # Footer
    footer_text = "Payment due within 30 days. Please include invoice number with payment. Thank you for your business."
    elements.append(Spacer(1, 12*mm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        leading=12,
    )
    elements.append(Paragraph(footer_text, footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer