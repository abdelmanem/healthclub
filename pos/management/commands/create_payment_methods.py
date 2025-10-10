"""
Management Command - Create Default Payment Methods

This command creates default payment methods for the spa management system.
Run with: python manage.py create_payment_methods
"""

from django.core.management.base import BaseCommand
from pos.models import PaymentMethod


class Command(BaseCommand):
    help = 'Create default payment methods for the spa management system'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update existing payment methods even if they exist',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating',
        )
    
    def handle(self, *args, **options):
        payment_methods = [
            {
                'name': 'Cash',
                'code': 'cash',
                'icon': '💵',
                'requires_reference': False,
                'display_order': 1,
                'description': 'Cash payment - no reference number required'
            },
            {
                'name': 'Credit Card',
                'code': 'credit_card',
                'icon': '💳',
                'requires_reference': True,
                'display_order': 2,
                'description': 'Credit card payment (Visa, MasterCard, American Express, etc.)'
            },
            {
                'name': 'Debit Card',
                'code': 'debit_card',
                'icon': '💳',
                'requires_reference': True,
                'display_order': 3,
                'description': 'Debit card payment with PIN'
            },
            {
                'name': 'Mobile Payment',
                'code': 'mobile_payment',
                'icon': '📱',
                'requires_reference': True,
                'display_order': 4,
                'description': 'Mobile payment (Apple Pay, Google Pay, Samsung Pay, etc.)'
            },
            {
                'name': 'Bank Transfer',
                'code': 'bank_transfer',
                'icon': '🏦',
                'requires_reference': True,
                'display_order': 5,
                'description': 'Bank transfer or wire payment'
            },
            {
                'name': 'Check',
                'code': 'check',
                'icon': '📝',
                'requires_reference': True,
                'display_order': 6,
                'description': 'Personal or business check payment'
            },
            {
                'name': 'Gift Card',
                'code': 'gift_card',
                'icon': '🎁',
                'requires_reference': True,
                'display_order': 7,
                'description': 'Gift card redemption - requires card number'
            },
            {
                'name': 'Account Credit',
                'code': 'account_credit',
                'icon': '💰',
                'requires_reference': False,
                'display_order': 8,
                'description': 'Payment from guest account credit balance'
            },
            {
                'name': 'Loyalty Points',
                'code': 'loyalty_points',
                'icon': '⭐',
                'requires_reference': False,
                'display_order': 9,
                'description': 'Payment using accumulated loyalty points'
            },
            {
                'name': 'Comp/Complimentary',
                'code': 'comp',
                'icon': '🎫',
                'requires_reference': False,
                'display_order': 10,
                'description': 'Complimentary service - no payment required'
            },
        ]
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made\n')
            )
        
        for method_data in payment_methods:
            try:
                # Check if payment method already exists
                existing_method = PaymentMethod.objects.filter(
                    code=method_data['code']
                ).first()
                
                if existing_method and not options['force']:
                    if not options['dry_run']:
                        skipped_count += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f'Skipped existing payment method: {existing_method.name}'
                            )
                        )
                    else:
                        self.stdout.write(
                            f'Would skip existing: {existing_method.name}'
                        )
                    continue
                
                if options['dry_run']:
                    if existing_method:
                        self.stdout.write(
                            f'Would update: {existing_method.name} → {method_data["name"]}'
                        )
                    else:
                        self.stdout.write(
                            f'Would create: {method_data["name"]}'
                        )
                    continue
                
                # Create or update payment method
                if existing_method:
                    # Update existing method
                    for key, value in method_data.items():
                        setattr(existing_method, key, value)
                    existing_method.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Updated payment method: {existing_method.name}')
                    )
                else:
                    # Create new method
                    method = PaymentMethod.objects.create(**method_data)
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Created payment method: {method.name}')
                    )
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing {method_data["name"]}: {str(e)}'
                    )
                )
        
        # Summary
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING('\nDry run completed - no changes made')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSummary: Created {created_count}, Updated {updated_count}, Skipped {skipped_count}'
                )
            )
            
            if created_count > 0 or updated_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        '\nPayment methods are now available in your spa management system!'
                    )
                )
                self.stdout.write(
                    'You can view them at: /api/payment-methods/'
                )
