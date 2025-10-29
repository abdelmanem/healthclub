from typing import Optional

def create_invoice_for_reservation(reservation, include_deposit_as_line_item=False):
    from decimal import Decimal
    from .models import Invoice, InvoiceItem, Payment, Deposit
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

    # Handle deposit - apply as payment, not as line item
    if reservation.deposit_required and reservation.deposit_amount:
        # Look for existing deposit for this reservation
        existing_deposit = Deposit.objects.filter(
            reservation=reservation,
            status__in=['pending', 'collected', 'partially_applied']
        ).first()
        
        if existing_deposit:
            # Apply the existing deposit to this invoice; if it fails, do not create a cash payment fallback.
            try:
                existing_deposit.apply_to_invoice(invoice)
            except Exception:
                # Leave deposit as collected; user can apply it explicitly later.
                pass
        else:
            # No deposit record exists — do not synthesize a cash payment. Keep the invoice unpaid
            # and let the operator collect a proper Deposit or process a regular payment.
            pass

    invoice.recalculate_totals()
    return invoice
