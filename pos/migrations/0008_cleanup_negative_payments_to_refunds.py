from django.db import migrations, models
from decimal import Decimal


def cleanup_negative_payments(apps, schema_editor):
    Payment = apps.get_model('pos', 'Payment')
    Refund = apps.get_model('pos', 'Refund')
    Invoice = apps.get_model('pos', 'Invoice')

    # Find all negative payments (legacy refunds)
    negatives = Payment.objects.filter(amount__lt=0)

    for p in negatives.iterator():
        amount = abs(p.amount)

        # Create proper Refund record
        refund = Refund.objects.create(
            invoice=p.invoice,
            original_payment=None,
            amount=amount,
            reason=p.notes or 'Migrated from legacy negative payment',
            refund_method='original_payment',
            status='processed',
            requested_by=p.processed_by,
            approved_by=p.processed_by,
            processed_by=p.processed_by,
            processed_at=p.payment_date,
            transaction_id=p.transaction_id,
            reference=p.reference,
            notes=f'Migrated from Payment #{p.id}',
        )

        # Recalculate invoice totals after migration for this invoice
        inv = Invoice.objects.get(pk=p.invoice_id)
        try:
            inv.recalculate_totals()
        except Exception:
            # best-effort during migration
            pass

    # Delete legacy negative payments
    negatives.delete()


class Migration(migrations.Migration):
    dependencies = [
        ('pos', '0007_remove_historicalpayment_is_refunded_and_more'),
    ]

    operations = [
        migrations.RunPython(cleanup_negative_payments, reverse_code=migrations.RunPython.noop),
    ]


