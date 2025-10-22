from django.core.management.base import BaseCommand
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from pos.views import InvoiceViewSet
from pos.models import Invoice

User = get_user_model()


class Command(BaseCommand):
    help = 'Test the available_deposits endpoint'

    def add_arguments(self, parser):
        parser.add_argument(
            '--invoice-id',
            type=int,
            required=True,
            help='Invoice ID to test',
        )

    def handle(self, *args, **options):
        invoice_id = options['invoice_id']
        
        try:
            invoice = Invoice.objects.get(id=invoice_id)
            self.stdout.write(f'Testing endpoint for Invoice ID {invoice_id}: {invoice.invoice_number}')
            
            # Create a mock request
            factory = RequestFactory()
            request = factory.get(f'/api/invoices/{invoice_id}/available_deposits/')
            
            # Get a user (first superuser or first user)
            user = User.objects.filter(is_superuser=True).first() or User.objects.first()
            if not user:
                self.stdout.write(self.style.ERROR('No users found!'))
                return
            
            request.user = user
            
            # Add query_params attribute for DRF compatibility
            request.query_params = request.GET
            
            # Create viewset instance and call the method
            viewset = InvoiceViewSet()
            viewset.request = request
            viewset.format_kwarg = None
            
            # Set the pk for the viewset
            viewset.kwargs = {'pk': invoice_id}
            
            try:
                response = viewset.available_deposits(request, pk=invoice_id)
                self.stdout.write(self.style.SUCCESS('Endpoint working!'))
                self.stdout.write(f'Response status: {response.status_code}')
                self.stdout.write(f'Response data: {response.data}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Endpoint error: {e}'))
                
        except Invoice.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Invoice ID {invoice_id} not found!')
            )
