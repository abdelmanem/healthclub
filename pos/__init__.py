from typing import Optional

def create_invoice_for_reservation(reservation, include_deposit_as_line_item=False):
    from decimal import Decimal
    from .models import Invoice, InvoiceItem, Payment
    from reservations.models import Reservation

    # Set initial invoice status based on reservation status
    initial_status = Invoice.STATUS_ISSUED
    if reservation.status == Reservation.STATUS_CANCELLED:
        initial_status = Invoice.STATUS_CANCELLED
    elif reservation.status == Reservation.STATUS_COMPLETED:
        initial_status = Invoice.STATUS_PAID
    elif reservation.status in [Reservation.STATUS_BOOKED, Reservation.STATUS_CHECKED_IN, Reservation.STATUS_IN_SERVICE]:
        initial_status = Invoice.STATUS_ISSUED
    
    invoice = Invoice.objects.create(
        guest=reservation.guest,
        reservation=reservation,
        invoice_number=Invoice.generate_invoice_number(),
        status=initial_status,
    )
    
    # Add one item per reserved service; fallback to a generic line if none
    reservation_services = list(reservation.reservation_services.select_related("service").all())
    if reservation_services:
        for rs in reservation_services:
            service = rs.service
            InvoiceItem.objects.create(
                invoice=invoice,
                service=service,
                product_name=service.name,
                quantity=rs.quantity or 1,
                unit_price=service.price,
                tax_rate=0,
            )
    else:
        # Generic line if services are not attached
        InvoiceItem.objects.create(
            invoice=invoice,
            product_name=f"Reservation #{reservation.id}",
            quantity=1,
            unit_price=Decimal("0.00"),
            tax_rate=0,
        )

    # Add deposit as a line item if required and not yet paid
    if reservation.deposit_required and reservation.deposit_amount and include_deposit_as_line_item:
        InvoiceItem.objects.create(
            invoice=invoice,
            product_name=f"Deposit for Reservation #{reservation.id}",
            quantity=1,
            unit_price=reservation.deposit_amount,
            tax_rate=0,
            notes="Prepayment deposit"
        )

    # Handle deposit if it was already paid (legacy support)
    if reservation.deposit_required and reservation.deposit_paid and reservation.deposit_amount and not include_deposit_as_line_item:
        # Check if there's already a deposit payment for this reservation
        existing_deposit_payment = Payment.objects.filter(
            invoice__reservation=reservation,
            payment_type='deposit',
            status='completed'
        ).first()
        
        if not existing_deposit_payment:
            # Apply deposit as a payment (do NOT add as a line item)
            Payment.objects.create(
                invoice=invoice,
                method='cash',  # use a valid method code
                payment_type='deposit',
                amount=reservation.deposit_amount,
                status='completed',
                notes=f'Deposit payment for reservation #{reservation.id}',
                processed_by=None
            )
        else:
            # Transfer the existing deposit payment to this invoice
            existing_deposit_payment.invoice = invoice
            existing_deposit_payment.save(update_fields=['invoice'])

    invoice.recalculate_totals()
    return invoice
