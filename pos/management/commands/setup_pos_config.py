"""
Management Command - Setup POS Configuration

This command creates default POS configuration settings.
Run with: python manage.py setup_pos_config
"""

from django.core.management.base import BaseCommand
from pos.models import PosConfig


class Command(BaseCommand):
    help = 'Setup default POS configuration settings'
    
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
            help='Force update existing configuration',
        )
    
    def handle(self, *args, **options):
        vat_rate = options['vat_rate']
        service_charge_rate = options['service_charge_rate']
        
        # Validate rates
        if vat_rate < 0 or vat_rate > 100:
            self.stdout.write(
                self.style.ERROR('VAT rate must be between 0 and 100')
            )
            return
            
        if service_charge_rate < 0 or service_charge_rate > 100:
            self.stdout.write(
                self.style.ERROR('Service charge rate must be between 0 and 100')
            )
            return
        
        # Check if configuration already exists
        existing_config = PosConfig.objects.first()
        
        if existing_config and not options['force']:
            self.stdout.write(
                self.style.WARNING(
                    f'POS configuration already exists:\n'
                    f'  VAT Rate: {existing_config.vat_rate}%\n'
                    f'  Service Charge Rate: {existing_config.service_charge_rate}%\n'
                    f'Use --force to update existing configuration'
                )
            )
            return
        
        # Create or update configuration
        if existing_config:
            existing_config.vat_rate = vat_rate
            existing_config.service_charge_rate = service_charge_rate
            existing_config.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated POS configuration:\n'
                    f'  VAT Rate: {vat_rate}%\n'
                    f'  Service Charge Rate: {service_charge_rate}%'
                )
            )
        else:
            config = PosConfig.objects.create(
                vat_rate=vat_rate,
                service_charge_rate=service_charge_rate
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Created POS configuration:\n'
                    f'  VAT Rate: {vat_rate}%\n'
                    f'  Service Charge Rate: {service_charge_rate}%'
                )
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                '\nPOS configuration is now ready for use!'
            )
        )
