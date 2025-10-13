from django.core.management.base import BaseCommand
from django.db.models import Sum
from decimal import Decimal

from pos.models import Refund, Payment, Invoice


class Command(BaseCommand):
    help = 'Verify refund integrity: every Refund has matching negative Payment and invoice totals align'

    def handle(self, *args, **options):
        errors = 0

        # 1) Each refund should have a matching negative payment (by Invoice, amount)
        for refund in Refund.objects.all():
            payments = Payment.objects.filter(
                invoice=refund.invoice,
                payment_type='refund',
                amount=-refund.amount,
            )
            if not payments.exists():
                self.stdout.write(self.style.ERROR(
                    f'Refund {refund.id} on invoice {refund.invoice_id} has no matching negative payment'
                ))
                errors += 1

        # 2) Invoice totals sanity check
        for inv in Invoice.objects.all():
            inv.recalculate_totals()
            # Ensure amount_paid equals sum of completed payments
            total_payments = inv.payments.filter(status='completed').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            if inv.amount_paid != total_payments:
                self.stdout.write(self.style.ERROR(
                    f'Invoice {inv.id}: amount_paid {inv.amount_paid} != sum(payments) {total_payments}'
                ))
                errors += 1

        if errors == 0:
            self.stdout.write(self.style.SUCCESS('Refund integrity OK'))
        else:
            self.stdout.write(self.style.WARNING(f'Refund integrity found {errors} issue(s)'))


