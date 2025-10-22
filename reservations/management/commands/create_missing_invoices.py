from django.core.management.base import BaseCommand
from django.db import transaction
from reservations.models import Reservation
from pos import create_invoice_for_reservation


class Command(BaseCommand):
    help = 'Create invoices for existing reservations that don\'t have them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually creating invoices',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find reservations without invoices
        reservations_without_invoices = Reservation.objects.filter(
            invoices__isnull=True
        ).distinct()
        
        count = reservations_without_invoices.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('All reservations already have invoices!')
            )
            return
        
        self.stdout.write(f'Found {count} reservations without invoices')
        
        if dry_run:
            self.stdout.write('DRY RUN - No invoices will be created')
            for reservation in reservations_without_invoices[:10]:  # Show first 10
                self.stdout.write(f'  - Reservation #{reservation.id} for {reservation.guest}')
            if count > 10:
                self.stdout.write(f'  ... and {count - 10} more')
            return
        
        created = 0
        failed = 0
        
        for reservation in reservations_without_invoices:
            try:
                with transaction.atomic():
                    include_deposit = reservation.deposit_required and reservation.deposit_amount
                    invoice = create_invoice_for_reservation(
                        reservation, 
                        include_deposit_as_line_item=include_deposit
                    )
                    created += 1
                    self.stdout.write(f'Created invoice for Reservation #{reservation.id}')
            except Exception as e:
                failed += 1
                self.stdout.write(
                    self.style.ERROR(f'Failed to create invoice for Reservation #{reservation.id}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created} invoices. {failed} failed.')
        )
