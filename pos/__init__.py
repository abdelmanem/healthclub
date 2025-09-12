from typing import Optional

def create_invoice_for_reservation(reservation) -> "Invoice":
    from decimal import Decimal
    from .models import Invoice, InvoiceItem

    invoice = Invoice.objects.create(
        guest=reservation.guest,
        reservation=reservation,
        invoice_number=Invoice.generate_invoice_number(),
        status=Invoice.STATUS_DRAFT,
    )
    # Add one item per reserved service; fallback to a generic line if none
    reservation_services = list(reservation.reservation_services.select_related("service").all())
    if reservation_services:
        for rs in reservation_services:
            service = rs.service
            InvoiceItem.objects.create(
                invoice=invoice,
                service=service,
                quantity=1,
                unit_price=service.price,
                tax_rate=0,
            )
    else:
        # Generic line if services are not attached
        InvoiceItem.objects.create(
            invoice=invoice,
            product_name=f"Reservation {reservation.id}",
            quantity=1,
            unit_price=Decimal("0.00"),
            tax_rate=0,
        )

    invoice.recalculate_totals()
    return invoice
