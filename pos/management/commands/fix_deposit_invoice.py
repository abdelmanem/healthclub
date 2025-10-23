from django.core.management.base import BaseCommand
from pos.models import Invoice, InvoiceItem, Payment, Deposit
from reservations.models import Reservation
from django.db import transaction

class Command(BaseCommand):
    help = 'Fix invoice deposit line item issue'

    def add_arguments(self, parser):
        parser.add_argument('reservation_id', type=int, help='Reservation ID to fix')

    def handle(self, *args, **options):
        reservation_id = options['reservation_id']
        
        try:
            # Get the reservation and invoice
            reservation = Reservation.objects.get(id=reservation_id)
            invoice = Invoice.objects.filter(reservation=reservation).first()
            
            if not invoice:
                self.stdout.write(self.style.ERROR(f'No invoice found for reservation {reservation_id}'))
                return
                
            self.stdout.write(f'Fixing invoice {invoice.invoice_number} for reservation {reservation_id}')
            
            with transaction.atomic():
                # Find and remove the incorrect deposit line item
                deposit_items = InvoiceItem.objects.filter(
                    invoice=invoice,
                    product_name__icontains='Deposit'
                )
                
                self.stdout.write(f'Found {deposit_items.count()} deposit line items to remove')
                for item in deposit_items:
                    self.stdout.write(f'  Removing: {item.product_name} - {item.line_total}')
                    item.delete()
                
                # Find the existing deposit
                deposit = Deposit.objects.filter(
                    reservation=reservation,
                    status__in=['pending', 'collected', 'partially_applied']
                ).first()
                
                if deposit and deposit.can_be_applied():
                    self.stdout.write(f'Applying deposit {deposit.id} (${deposit.remaining_amount}) as payment')
                    try:
                        payment = deposit.apply_to_invoice(invoice)
                        self.stdout.write(f'  Created payment: {payment.payment_type} - ${payment.amount}')
                    except Exception as e:
                        self.stdout.write(f'  Error applying deposit: {e}')
                        # Create payment manually if apply_to_invoice fails
                        payment = Payment.objects.create(
                            invoice=invoice,
                            method='deposit',
                            payment_type='deposit_application',
                            amount=deposit.remaining_amount,
                            status='completed',
                            reference=f'Deposit #{deposit.id}',
                            notes=f'Applied from deposit collected on {deposit.collected_at.strftime("%Y-%m-%d") if deposit.collected_at else ""}'
                        )
                        self.stdout.write(f'  Created payment manually: {payment.payment_type} - ${payment.amount}')
                else:
                    self.stdout.write('No applicable deposit found')
                
                # Recalculate invoice totals
                invoice.recalculate_totals()
                self.stdout.write(f'Invoice recalculated:')
                self.stdout.write(f'  Total: {invoice.total}')
                self.stdout.write(f'  Amount paid: {invoice.amount_paid}')
                self.stdout.write(f'  Balance due: {invoice.balance_due}')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {e}'))
            import traceback
            traceback.print_exc()
