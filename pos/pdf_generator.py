"""
PDF generation utility for invoices using reportlab
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.pdfgen import canvas
from decimal import Decimal
from django.utils import timezone
from datetime import datetime


def generate_invoice_pdf(invoice):
    """
    Generate a PDF for an invoice using reportlab
    
    Args:
        invoice: Invoice model instance
        
    Returns:
        BytesIO: PDF file as bytes
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
                           leftMargin=15*mm, rightMargin=15*mm)
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a73e8'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=12,
    )
    
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 12
    
    # Get company name (you can make this configurable)
    company_name = "Health Club Management System"
    
    # Title
    elements.append(Paragraph(company_name, title_style))
    elements.append(Spacer(1, 10*mm))
    
    # Invoice header
    invoice_date_str = ''
    if invoice.date:
        if isinstance(invoice.date, datetime):
            invoice_date_str = invoice.date.strftime('%B %d, %Y')
        else:
            invoice_date_str = str(invoice.date)
    
    due_date_str = ''
    if invoice.due_date:
        if hasattr(invoice.due_date, 'strftime'):
            due_date_str = invoice.due_date.strftime('%B %d, %Y')
        else:
            due_date_str = str(invoice.due_date)
    
    header_data = [
        ['Invoice Number:', invoice.invoice_number or 'N/A'],
        ['Date:', invoice_date_str],
        ['Due Date:', due_date_str],
    ]
    
    header_table = Table(header_data, colWidths=[60*mm, 100*mm])
    header_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('ALIGN', (0, 0), (0, -1), TA_LEFT),
        ('ALIGN', (1, 0), (1, -1), TA_LEFT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8*mm))
    
    # Bill to section
    guest_name = f"{invoice.guest.first_name} {invoice.guest.last_name}" if invoice.guest else "N/A"
    guest_email = invoice.guest.email if invoice.guest and invoice.guest.email else ""
    
    bill_to_data = [
        ['Bill To:', ''],
        ['', guest_name],
    ]
    if guest_email:
        bill_to_data.append(['', guest_email])
    
    bill_to_table = Table(bill_to_data, colWidths=[60*mm, 100*mm])
    bill_to_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), TA_LEFT),
        ('ALIGN', (1, 0), (1, -1), TA_LEFT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(bill_to_table)
    elements.append(Spacer(1, 10*mm))
    
    # Invoice items table
    items_data = [['Description', 'Qty', 'Unit Price', 'Tax %', 'Total']]
    
    for item in invoice.items.all():
        description = item.product_name or 'N/A'
        if hasattr(item, 'notes') and item.notes:
            description += f" ({item.notes})"
        
        # Calculate line total if not available
        line_total = item.line_total if hasattr(item, 'line_total') else item.unit_price * item.quantity
        
        items_data.append([
            description,
            str(item.quantity),
            f"${float(item.unit_price):.2f}",
            f"{float(item.tax_rate):.1f}%",
            f"${float(line_total):.2f}",
        ])
    
    items_table = Table(items_data, colWidths=[80*mm, 20*mm, 25*mm, 20*mm, 25*mm])
    items_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('ALIGN', (0, 0), (-1, 0), TA_CENTER),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (0, -1), TA_LEFT),
        ('ALIGN', (1, 1), (-1, -1), TA_RIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 10*mm))
    
    # Totals section
    totals_data = []
    totals_data.append(['Subtotal:', f"${float(invoice.subtotal):.2f}"])
    
    service_charge_val = Decimal(str(invoice.service_charge)) if invoice.service_charge else Decimal('0.00')
    if service_charge_val > 0:
        totals_data.append(['Service Charge:', f"${float(service_charge_val):.2f}"])
    
    totals_data.append(['Tax:', f"${float(invoice.tax):.2f}"])
    
    discount_val = Decimal(str(invoice.discount)) if invoice.discount else Decimal('0.00')
    if discount_val > 0:
        totals_data.append(['Discount:', f"-${float(discount_val):.2f}"])
    
    totals_data.append(['', ''])  # Spacer
    totals_data.append(['Total:', f"<b>${float(invoice.total):.2f}</b>"])
    totals_data.append(['Amount Paid:', f"${float(invoice.amount_paid):.2f}"])
    totals_data.append(['Balance Due:', f"<b>${float(invoice.balance_due):.2f}</b>"])
    
    totals_table = Table(totals_data, colWidths=[120*mm, 50*mm])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica'),
        ('FONTNAME', (1, 0), (1, -3), 'Helvetica'),
        ('FONTNAME', (1, -3), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), TA_RIGHT),
        ('ALIGN', (1, 0), (1, -1), TA_RIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (0, -4), (-1, -4), 1, colors.HexColor('#cccccc')),
        ('LINEABOVE', (0, -3), (-1, -3), 1, colors.HexColor('#333333')),
        ('TEXTCOLOR', (1, -2), (1, -1), colors.HexColor('#1a73e8')),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10*mm))
    
    # Notes section
    if invoice.notes:
        elements.append(Paragraph('<b>Notes:</b>', heading_style))
        elements.append(Paragraph(invoice.notes, normal_style))
        elements.append(Spacer(1, 8*mm))
    
    # Footer
    footer_text = "Payment due within 30 days. Please include invoice number with payment.<br/>Thank you for your business."
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph(footer_text, ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER,
    )))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer

