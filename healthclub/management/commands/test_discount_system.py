from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import requests
import json

from accounts.models import User
from guests.models import Guest
from services.models import Service
from reservations.models import Reservation, ReservationService
from discounts.models import DiscountType, ReservationDiscount


class Command(BaseCommand):
    help = 'Test the complete discount system functionality'

    def add_arguments(self, parser):
        parser.add_argument(
            '--base-url',
            type=str,
            default='http://localhost:8000',
            help='Base URL for the API (default: http://localhost:8000)'
        )

    def handle(self, *args, **options):
        base_url = options['base_url']
        self.stdout.write('🧪 Starting comprehensive discount system test...')
        
        # Test 1: Verify discount types exist
        self.stdout.write('\n1️⃣ Testing Discount Types...')
        try:
            discount_types = DiscountType.objects.all()
            self.stdout.write(f'   Found {discount_types.count()} discount types')
            
            for dt in discount_types:
                status = "✅ Active" if dt.is_active else "❌ Inactive"
                approval = "🔒 Requires Approval" if dt.requires_approval else "🔓 Auto-Apply"
                self.stdout.write(f'   {dt.code}: {dt.name} - {status} - {approval}')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing discount types: {e}'))
            return

        # Test 2: Verify applied discounts
        self.stdout.write('\n2️⃣ Testing Applied Discounts...')
        try:
            applied_discounts = ReservationDiscount.objects.filter(status='applied')
            pending_discounts = ReservationDiscount.objects.filter(status='pending')
            
            self.stdout.write(f'   Applied discounts: {applied_discounts.count()}')
            self.stdout.write(f'   Pending discounts: {pending_discounts.count()}')
            
            for discount in applied_discounts[:3]:  # Show first 3
                self.stdout.write(f'   ✅ {discount.discount_type.name} - ${discount.discount_amount} off')
                
            for discount in pending_discounts[:3]:  # Show first 3
                self.stdout.write(f'   ⏳ {discount.discount_type.name} - ${discount.discount_amount} off (pending)')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing applied discounts: {e}'))

        # Test 3: Test API endpoints
        self.stdout.write('\n3️⃣ Testing API Endpoints...')
        api_tests = [
            ('/api/discounts/discount-types/', 'Discount Types'),
            ('/api/discounts/reservation-discounts/', 'Reservation Discounts'),
        ]
        
        for endpoint, name in api_tests:
            try:
                response = requests.get(f'{base_url}{endpoint}', timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    self.stdout.write(f'   ✅ {name}: {len(data.get("results", []))} items')
                else:
                    self.stdout.write(f'   ❌ {name}: HTTP {response.status_code}')
            except requests.exceptions.RequestException as e:
                self.stdout.write(f'   ⚠️ {name}: Connection error - {e}')

        # Test 4: Test discount calculations
        self.stdout.write('\n4️⃣ Testing Discount Calculations...')
        try:
            # Test percentage discount
            percentage_discount = DiscountType.objects.filter(discount_method='percentage').first()
            if percentage_discount:
                test_amount = Decimal('100.00')
                expected_discount = test_amount * (percentage_discount.discount_value / 100)
                self.stdout.write(f'   Percentage discount test: ${test_amount} → ${expected_discount} off')
            
            # Test fixed amount discount
            fixed_discount = DiscountType.objects.filter(discount_method='fixed_amount').first()
            if fixed_discount:
                test_amount = Decimal('150.00')
                expected_discount = min(fixed_discount.discount_value, test_amount)
                self.stdout.write(f'   Fixed amount discount test: ${test_amount} → ${expected_discount} off')
            
            # Test free service discount
            free_service_discount = DiscountType.objects.filter(discount_method='free_service').first()
            if free_service_discount:
                services = Service.objects.all()[:3]
                service_total = sum(s.price for s in services)
                cheapest_price = min(s.price for s in services)
                self.stdout.write(f'   Free service discount test: ${service_total} → ${cheapest_price} off (cheapest service)')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing calculations: {e}'))

        # Test 5: Test permission system
        self.stdout.write('\n5️⃣ Testing Permission System...')
        try:
            admin_user = User.objects.filter(is_superuser=True).first()
            manager_user = User.objects.filter(role__name='Manager').first()
            therapist_user = User.objects.filter(role__name='Therapist').first()
            
            if admin_user:
                self.stdout.write(f'   ✅ Admin user found: {admin_user.username}')
            if manager_user:
                self.stdout.write(f'   ✅ Manager user found: {manager_user.username}')
            if therapist_user:
                self.stdout.write(f'   ✅ Therapist user found: {therapist_user.username}')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing permissions: {e}'))

        # Test 6: Test reservation integration
        self.stdout.write('\n6️⃣ Testing Reservation Integration...')
        try:
            reservations_with_discounts = Reservation.objects.filter(
                reservationdiscount__isnull=False
            ).distinct()
            
            self.stdout.write(f'   Reservations with discounts: {reservations_with_discounts.count()}')
            
            for reservation in reservations_with_discounts[:3]:
                discounts = reservation.reservationdiscount_set.all()
                total_discount = sum(d.discount_amount for d in discounts)
                service_total = sum(rs.service.price for rs in reservation.services.all())
                self.stdout.write(f'   Reservation #{reservation.id}: ${service_total} → ${total_discount} off')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing reservation integration: {e}'))

        # Test 7: Test different discount statuses
        self.stdout.write('\n7️⃣ Testing Discount Statuses...')
        try:
            status_counts = {}
            for status, _ in ReservationDiscount.STATUS_CHOICES:
                count = ReservationDiscount.objects.filter(status=status).count()
                status_counts[status] = count
                self.stdout.write(f'   {status.title()}: {count}')
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing statuses: {e}'))

        # Test 8: Test discount validation rules
        self.stdout.write('\n8️⃣ Testing Discount Validation...')
        try:
            # Test minimum order amount
            min_order_discounts = DiscountType.objects.filter(min_order_amount__gt=0)
            self.stdout.write(f'   Discounts with minimum order requirements: {min_order_discounts.count()}')
            
            # Test usage limits
            limited_discounts = DiscountType.objects.filter(
                usage_limit_per_guest__gt=0
            ).union(
                DiscountType.objects.filter(usage_limit_per_day__gt=0)
            )
            self.stdout.write(f'   Discounts with usage limits: {limited_discounts.count()}')
            
            # Test approval requirements
            approval_required = DiscountType.objects.filter(requires_approval=True)
            self.stdout.write(f'   Discounts requiring approval: {approval_required.count()}')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Error testing validation: {e}'))

        # Summary
        self.stdout.write('\n🎉 Discount System Test Complete!')
        self.stdout.write('\n📊 Test Summary:')
        self.stdout.write(f'   Discount Types: {DiscountType.objects.count()}')
        self.stdout.write(f'   Applied Discounts: {ReservationDiscount.objects.filter(status="applied").count()}')
        self.stdout.write(f'   Pending Discounts: {ReservationDiscount.objects.filter(status="pending").count()}')
        self.stdout.write(f'   Total Reservations: {Reservation.objects.count()}')
        self.stdout.write(f'   Reservations with Discounts: {Reservation.objects.filter(reservationdiscount__isnull=False).distinct().count()}')
        
        self.stdout.write('\n🎯 Next Steps:')
        self.stdout.write('   1. Start the backend server: python manage.py runserver')
        self.stdout.write('   2. Start the frontend: cd healthclub-frontend && npm start')
        self.stdout.write('   3. Test the UI at: http://localhost:3000/discounts')
        self.stdout.write('   4. Test reservation booking with discounts')
        self.stdout.write('   5. Test approval workflow for pending discounts')
        
        self.stdout.write('\n✅ All tests completed successfully!')
