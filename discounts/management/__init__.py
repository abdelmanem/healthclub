from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from discounts.models import DiscountType
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample discount types for the health club'

    def handle(self, *args, **options):
        # Get or create a superuser for created_by field
        superuser = User.objects.filter(is_superuser=True).first()
        if not superuser:
            self.stdout.write(
                self.style.WARNING('No superuser found. Creating discount types without created_by field.')
            )

        # Sample discount types
        discount_types = [
            {
                'name': 'First Time Guest',
                'code': 'FIRST_TIME',
                'description': '20% discount for first-time guests',
                'discount_method': 'percentage',
                'discount_value': Decimal('20.00'),
                'max_discount_amount': Decimal('50.00'),
                'is_active': True,
                'requires_approval': False,
                'usage_limit_per_guest': 1,
            },
            {
                'name': 'Employee Discount',
                'code': 'EMP_10',
                'description': '10% discount for employee referrals',
                'discount_method': 'percentage',
                'discount_value': Decimal('10.00'),
                'max_discount_amount': Decimal('25.00'),
                'is_active': True,
                'requires_approval': True,
            },
            {
                'name': 'Senior Citizen',
                'code': 'SENIOR',
                'description': '15% discount for guests 65 and older',
                'discount_method': 'percentage',
                'discount_value': Decimal('15.00'),
                'max_discount_amount': Decimal('30.00'),
                'is_active': True,
                'requires_approval': False,
            },
            {
                'name': 'Bulk Booking',
                'code': 'BULK_5',
                'description': '$5 off for bookings of 5 or more services',
                'discount_method': 'fixed_amount',
                'discount_value': Decimal('5.00'),
                'min_order_amount': Decimal('100.00'),
                'is_active': True,
                'requires_approval': False,
            },
            {
                'name': 'VIP Member',
                'code': 'VIP_FREE',
                'description': 'Free service for VIP members',
                'discount_method': 'free_service',
                'discount_value': Decimal('0.00'),
                'is_active': True,
                'requires_approval': True,
            },
            {
                'name': 'Holiday Special',
                'code': 'HOLIDAY_25',
                'description': '25% off during holiday season',
                'discount_method': 'percentage',
                'discount_value': Decimal('25.00'),
                'max_discount_amount': Decimal('100.00'),
                'is_active': True,
                'requires_approval': False,
            },
        ]

        created_count = 0
        updated_count = 0

        for discount_data in discount_types:
            discount_type, created = DiscountType.objects.get_or_create(
                code=discount_data['code'],
                defaults={
                    **discount_data,
                    'created_by': superuser,
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created discount type: {discount_type.name}')
                )
            else:
                # Update existing discount type
                for key, value in discount_data.items():
                    setattr(discount_type, key, value)
                discount_type.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated discount type: {discount_type.name}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDiscount setup complete!\n'
                f'Created: {created_count} discount types\n'
                f'Updated: {updated_count} discount types'
            )
        )
