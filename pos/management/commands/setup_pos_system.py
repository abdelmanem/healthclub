"""
Management Command - Setup Complete POS System

This command sets up the entire POS system with default configurations.
Run with: python manage.py setup_pos_system
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Setup complete POS system with default configurations'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--vat-rate',
            type=float,
            default=8.0,
            help='VAT rate percentage (default: 8.0)',
        )
        parser.add_argument(
            '--service-charge-rate',
            type=float,
            default=10.0,
            help='Service charge rate percentage (default: 10.0)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update existing configurations',
        )
        parser.add_argument(
            '--skip-payment-methods',
            action='store_true',
            help='Skip creating payment methods',
        )
        parser.add_argument(
            '--skip-pos-config',
            action='store_true',
            help='Skip creating POS configuration',
        )
    
    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Setting up POS System...\n')
        )
        
        # Setup POS Configuration
        if not options['skip_pos_config']:
            self.stdout.write(
                self.style.WARNING('📊 Setting up POS configuration...')
            )
            try:
                call_command(
                    'setup_pos_config',
                    vat_rate=options['vat_rate'],
                    service_charge_rate=options['service_charge_rate'],
                    force=options['force']
                )
                self.stdout.write(
                    self.style.SUCCESS('✅ POS configuration setup complete\n')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error setting up POS config: {str(e)}\n')
                )
        else:
            self.stdout.write(
                self.style.WARNING('⏭️  Skipping POS configuration setup\n')
            )
        
        # Setup Payment Methods
        if not options['skip_payment_methods']:
            self.stdout.write(
                self.style.WARNING('💳 Setting up payment methods...')
            )
            try:
                call_command(
                    'create_payment_methods',
                    force=options['force']
                )
                self.stdout.write(
                    self.style.SUCCESS('✅ Payment methods setup complete\n')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error setting up payment methods: {str(e)}\n')
                )
        else:
            self.stdout.write(
                self.style.WARNING('⏭️  Skipping payment methods setup\n')
            )
        
        # Final summary
        self.stdout.write(
            self.style.SUCCESS('🎉 POS System Setup Complete!\n')
        )
        
        self.stdout.write(
            self.style.SUCCESS('Available API Endpoints:')
        )
        self.stdout.write('  📋 Invoices: /api/invoices/')
        self.stdout.write('  💰 Payments: /api/payments/')
        self.stdout.write('  💳 Payment Methods: /api/payment-methods/')
        self.stdout.write('  📚 API Documentation: /api/docs/\n')
        
        self.stdout.write(
            self.style.SUCCESS('Next Steps:')
        )
        self.stdout.write('  1. Run migrations: python manage.py migrate')
        self.stdout.write('  2. Create a superuser: python manage.py createsuperuser')
        self.stdout.write('  3. Start the server: python manage.py runserver')
        self.stdout.write('  4. Visit /api/docs/ to explore the API')
        self.stdout.write('  5. Test payment processing with sample invoices')
