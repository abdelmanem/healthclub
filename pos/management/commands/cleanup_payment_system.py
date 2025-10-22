"""
Management command to clean up the payment system
Based on POS.md analysis and recommendations
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from pos.models import Payment, Refund, Deposit, Invoice


class Command(BaseCommand):
    help = 'Clean up payment system and fix data issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        # Step 1: Clean up negative payments
        self.cleanup_negative_payments(dry_run)
        
        # Step 2: Convert refund payments to proper Refund records
        self.convert_refund_payments(dry_run)
        
        # Step 3: Fix deposit tracking
        self.fix_deposit_tracking(dry_run)
        
        # Step 4: Recalculate all invoices
        if not dry_run:
            with transaction.atomic():
                self.recalculate_invoices(dry_run)
        else:
            self.recalculate_invoices(dry_run)
        
        self.stdout.write(self.style.SUCCESS('Payment system cleanup completed!'))

    def cleanup_negative_payments(self, dry_run):
        """Remove negative payments and convert to proper refunds"""
        self.stdout.write('Step 1: Cleaning up negative payments...')
        
        # Find all negative payments
        negative_payments = Payment.objects.filter(amount__lt=0)
        count = negative_payments.count()
        
        if count == 0:
            self.stdout.write('  No negative payments found')
            return
        
        self.stdout.write(f'  Found {count} negative payments')
        
        for payment in negative_payments:
            if not dry_run:
                # Create proper Refund record
                Refund.objects.create(
                    invoice=payment.invoice,
                    original_payment=None,  # Can't determine from negative payment
                    amount=abs(payment.amount),
                    reason=payment.notes or 'Migrated from legacy refund payment',
                    refund_method='original_payment',
                    status='processed',
                    requested_by=payment.processed_by,
                    processed_by=payment.processed_by,
                    processed_at=payment.payment_date,
                    transaction_id=payment.transaction_id,
                    reference=payment.reference,
                    notes=f'Migrated from Payment #{payment.id}'
                )
                
                # Delete the negative payment
                payment.delete()
            
            self.stdout.write(f'  Converted Payment #{payment.id} to Refund record')
        
        self.stdout.write(f'  Converted {count} negative payments to Refund records')

    def convert_refund_payments(self, dry_run):
        """Convert payment_type='refund' payments to proper Refund records"""
        self.stdout.write('Step 2: Converting refund payments...')
        
        refund_payments = Payment.objects.filter(payment_type='refund')
        count = refund_payments.count()
        
        if count == 0:
            self.stdout.write('  No refund payments found')
            return
        
        self.stdout.write(f'  Found {count} refund payments')
        
        for payment in refund_payments:
            if not dry_run:
                # Create proper Refund record
                Refund.objects.create(
                    invoice=payment.invoice,
                    original_payment=None,
                    amount=abs(payment.amount),
                    reason=payment.notes or 'Migrated from legacy refund payment',
                    refund_method='original_payment',
                    status='processed',
                    requested_by=payment.processed_by,
                    processed_by=payment.processed_by,
                    processed_at=payment.payment_date,
                    transaction_id=payment.transaction_id,
                    reference=payment.reference,
                    notes=f'Migrated from Payment #{payment.id}'
                )
                
                # Delete the refund payment
                payment.delete()
            
            self.stdout.write(f'  Converted Payment #{payment.id} to Refund record')
        
        self.stdout.write(f'  Converted {count} refund payments to Refund records')

    def fix_deposit_tracking(self, dry_run):
        """Fix deposit tracking and relationships"""
        self.stdout.write('Step 3: Fixing deposit tracking...')
        
        # Find deposits that need status updates
        from django.db.models import F
        deposits_to_fix = Deposit.objects.filter(
            status='paid',
            amount_applied__lt=F('amount')
        )
        
        count = deposits_to_fix.count()
        if count == 0:
            self.stdout.write('  No deposits need fixing')
            return
        
        self.stdout.write(f'  Found {count} deposits to fix')
        
        for deposit in deposits_to_fix:
            if not dry_run:
                # Update status based on amount_applied
                if deposit.amount_applied == 0:
                    deposit.status = 'collected'
                elif deposit.amount_applied < deposit.amount:
                    deposit.status = 'partially_applied'
                else:
                    deposit.status = 'fully_applied'
                
                deposit.save(update_fields=['status'])
            
            self.stdout.write(f'  Fixed Deposit #{deposit.id} status')
        
        self.stdout.write(f'  Fixed {count} deposits')

    def recalculate_invoices(self, dry_run):
        """Recalculate all invoice totals"""
        self.stdout.write('Step 4: Recalculating invoice totals...')
        
        invoices = Invoice.objects.all()
        count = invoices.count()
        
        if count == 0:
            self.stdout.write('  No invoices found')
            return
        
        self.stdout.write(f'  Recalculating {count} invoices...')
        
        for invoice in invoices:
            if not dry_run:
                invoice.recalculate_totals()
            
            self.stdout.write(f'  Recalculated Invoice #{invoice.id}')
        
        self.stdout.write(f'  Recalculated {count} invoices')

    def show_summary(self):
        """Show summary of current system state"""
        self.stdout.write('\n' + '='*50)
        self.stdout.write('PAYMENT SYSTEM SUMMARY')
        self.stdout.write('='*50)
        
        # Count records
        invoice_count = Invoice.objects.count()
        payment_count = Payment.objects.count()
        refund_count = Refund.objects.count()
        deposit_count = Deposit.objects.count()
        
        self.stdout.write(f'Invoices: {invoice_count}')
        self.stdout.write(f'Payments: {payment_count}')
        self.stdout.write(f'Refunds: {refund_count}')
        self.stdout.write(f'Deposits: {deposit_count}')
        
        # Check for issues
        negative_payments = Payment.objects.filter(amount__lt=0).count()
        refund_payments = Payment.objects.filter(payment_type='refund').count()
        
        if negative_payments > 0:
            self.stdout.write(self.style.ERROR(f'  ⚠️  {negative_payments} negative payments found'))
        
        if refund_payments > 0:
            self.stdout.write(self.style.ERROR(f'  ⚠️  {refund_payments} refund payments found'))
        
        if negative_payments == 0 and refund_payments == 0:
            self.stdout.write(self.style.SUCCESS('  ✅ No payment system issues found'))
        
        self.stdout.write('='*50)
