from django.core.management.base import BaseCommand
from pos.models import Invoice


class Command(BaseCommand):
    help = 'Check existing invoices and their details'

    def add_arguments(self, parser):
        parser.add_argument(
            '--invoice-id',
            type=int,
            help='Check specific invoice ID',
        )

    def handle(self, *args, **options):
        invoice_id = options.get('invoice_id')
        
        if invoice_id:
            try:
                invoice = Invoice.objects.get(id=invoice_id)
                self.stdout.write(f'Invoice ID {invoice_id} found:')
                self.stdout.write(f'  - Invoice Number: {invoice.invoice_number}')
                self.stdout.write(f'  - Guest: {invoice.guest.first_name} {invoice.guest.last_name}')
                self.stdout.write(f'  - Reservation: {invoice.reservation_id}')
                self.stdout.write(f'  - Status: {invoice.status}')
                self.stdout.write(f'  - Total: ${invoice.total}')
                self.stdout.write(f'  - Balance Due: ${invoice.balance_due}')
            except Invoice.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Invoice ID {invoice_id} not found!')
                )
        else:
            # Show all invoices
            invoices = Invoice.objects.all().order_by('-id')[:10]
            
            if not invoices:
                self.stdout.write('No invoices found!')
                return
            
            self.stdout.write('Recent invoices:')
            for invoice in invoices:
                self.stdout.write(
                    f'  ID {invoice.id}: {invoice.invoice_number} - '
                    f'{invoice.guest.first_name} {invoice.guest.last_name} - '
                    f'${invoice.total} ({invoice.status})'
                )
