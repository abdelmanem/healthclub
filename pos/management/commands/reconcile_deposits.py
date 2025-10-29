from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from pos.models import Deposit, Payment, Invoice


class Command(BaseCommand):
    help = "Reconcile deposit records with payments: if a deposit payment exists but the deposit still shows as not applied, fix amount_applied/status."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Do not write changes, only report')
        parser.add_argument('--guest', type=int, help='Limit to guest ID')
        parser.add_argument('--invoice', type=int, help='Limit to invoice ID')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run')
        guest_id = options.get('guest')
        invoice_id = options.get('invoice')

        fixes = 0
        scanned = 0

        qs = Deposit.objects.all()
        if guest_id:
            qs = qs.filter(guest_id=guest_id)

        for dep in qs.order_by('id'):
            scanned += 1
            remaining = dep.amount - dep.amount_applied
            if remaining <= Decimal('0.00'):
                # Already fully applied
                continue

            # Look for a payment on any invoice for this guest/reservation that looks like a deposit application
            payments = Payment.objects.filter(
                invoice__guest_id=dep.guest_id,
                payment_type='deposit_application',
                method='deposit',
                status='completed',
            ).order_by('-payment_date')

            if invoice_id:
                payments = payments.filter(invoice_id=invoice_id)

            # Heuristic: if any such payment exists after deposit collection, assume it should decrement the deposit
            candidate = None
            for p in payments:
                # If a reference explicitly points to this deposit, prefer it
                if f"Deposit #{dep.id}" in (p.reference or ''):
                    candidate = p
                    break
                # Otherwise pick the most recent where the invoice reservation matches
                if dep.reservation_id and p.invoice.reservation_id == dep.reservation_id:
                    candidate = p
                    break

            if not candidate:
                continue

            apply_amt = min(candidate.amount, remaining)

            if dry_run:
                self.stdout.write(
                    f"[DRY] Would apply {apply_amt} of deposit {dep.id} to invoice {candidate.invoice_id} (remaining {remaining})"
                )
                continue

            with transaction.atomic():
                dep_locked = Deposit.objects.select_for_update().get(pk=dep.pk)
                new_applied = dep_locked.amount_applied + apply_amt
                dep_locked.amount_applied = new_applied
                dep_locked.status = 'fully_applied' if new_applied >= dep_locked.amount else 'partially_applied'
                dep_locked.save(update_fields=['amount_applied', 'status'])
                fixes += 1
                self.stdout.write(
                    f"Applied {apply_amt} to deposit {dep_locked.id}; status={dep_locked.status}"
                )

        self.stdout.write(self.style.SUCCESS(f"Scanned {scanned} deposits; fixed {fixes}"))


