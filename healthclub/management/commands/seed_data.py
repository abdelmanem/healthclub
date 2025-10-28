from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import random

from accounts.models import Role, User
from guests.models import Guest, GuestAddress, EmergencyContact
from services.models import Service, ServiceCategory
from reservations.models import Location, Reservation, ReservationService
from employees.models import Employee, ReservationEmployeeAssignment
from pos.models import Invoice, Payment, PaymentMethod
from config.models import MembershipTier, GenderOption
from discounts.models import DiscountType, ReservationDiscount


class Command(BaseCommand):
    help = 'Create comprehensive sample data for testing'

    def handle(self, *args, **options):
        self.stdout.write('🌱 Starting comprehensive sample data creation...')

        # 1. Initialize configurations
        self.stdout.write('📋 Initializing configurations...')
        from django.core.management import call_command
        try:
            call_command('init_config')
            self.stdout.write(self.style.SUCCESS('✅ Configurations initialized'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Configuration initialization failed: {e}'))

        # 1b. Ensure default payment methods exist
        self.stdout.write('💳 Creating payment methods...')
        try:
            call_command('create_payment_methods', '--force')
            self.stdout.write(self.style.SUCCESS('✅ Payment methods ensured'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Payment methods setup failed: {e}'))

        # 1c. Ensure POS configuration exists (VAT, service charge)
        self.stdout.write('🧾 Setting up POS configuration...')
        try:
            call_command('setup_pos_config', '--force')
            self.stdout.write(self.style.SUCCESS('✅ POS configuration ensured'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ POS configuration setup failed: {e}'))

        # 1d. Ensure discount types exist
        self.stdout.write('🏷️  Setting up sample discount types...')
        try:
            call_command('setup_discounts')
            self.stdout.write(self.style.SUCCESS('✅ Discount types ensured'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Discount setup failed: {e}'))

        # 2. Get or create membership tiers
        self.stdout.write('👑 Creating membership tiers...')
        try:
            bronze_tier = MembershipTier.objects.get(name='bronze')
            silver_tier = MembershipTier.objects.get(name='silver')
            gold_tier = MembershipTier.objects.get(name='gold')
            self.stdout.write(self.style.SUCCESS('✅ Membership tiers found'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Membership tiers not found: {e}'))
            # Create basic tiers if they don't exist
            bronze_tier = MembershipTier.objects.create(name='bronze', display_name='Bronze', discount_percentage=0)
            silver_tier = MembershipTier.objects.create(name='silver', display_name='Silver', discount_percentage=5)
            gold_tier = MembershipTier.objects.create(name='gold', display_name='Gold', discount_percentage=10)

        # 3. Get or create gender options
        self.stdout.write('⚧ Creating gender options...')
        try:
            male_gender = GenderOption.objects.get(code='male')
            female_gender = GenderOption.objects.get(code='female')
            self.stdout.write(self.style.SUCCESS('✅ Gender options found'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Gender options not found: {e}'))
            # Create basic gender options if they don't exist
            male_gender = GenderOption.objects.create(code='male', display_name='Male')
            female_gender = GenderOption.objects.create(code='female', display_name='Female')

        # 4. Create roles and users
        self.stdout.write('👥 Creating roles and users...')
        therapist_role, _ = Role.objects.get_or_create(name="Therapist", defaults={"description": "Therapist role"})
        manager_role, _ = Role.objects.get_or_create(name="Manager", defaults={"description": "Manager role"})
        admin_role, _ = Role.objects.get_or_create(name="Admin", defaults={"description": "Admin role"})
        
        # Create admin user
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@healthclub.com",
                "role": admin_role,
                "first_name": "Admin",
                "last_name": "User",
                "is_staff": True,
                "is_superuser": True,
            }
        )
        if created:
            admin_user.set_password("admin123")
            admin_user.save()
        
        # Create manager user
        manager_user, created = User.objects.get_or_create(
            username="manager1",
            defaults={
                "email": "manager@healthclub.com",
                "role": manager_role,
                "first_name": "Sarah",
                "last_name": "Manager",
            }
        )
        if created:
            manager_user.set_password("manager123")
            manager_user.save()
        
        # Create therapist user
        therapist_user, created = User.objects.get_or_create(
            username="therapist1",
            defaults={
                "email": "therapist1@healthclub.com",
                "role": therapist_role,
                "first_name": "John",
                "last_name": "Therapist",
            }
        )
        if created:
            therapist_user.set_password("therapist123")
            therapist_user.save()
        
        self.stdout.write(self.style.SUCCESS('✅ Users created'))

        # 5. Create locations
        self.stdout.write('🏢 Creating locations...')
        locations_data = [
            {"name": "Room 1", "description": "Massage room", "capacity": 1},
            {"name": "Room 2", "description": "Sauna room", "capacity": 2},
            {"name": "Room 3", "description": "Spa treatment room", "capacity": 1},
            {"name": "Room 4", "description": "Fitness room", "capacity": 10},
        ]
        
        created_locations = {}
        for loc_data in locations_data:
            location, created = Location.objects.get_or_create(
                name=loc_data["name"],
                defaults=loc_data
            )
            created_locations[loc_data["name"]] = location
        self.stdout.write(self.style.SUCCESS('✅ Locations created'))

        # 6. Create service categories and services
        self.stdout.write('💆 Creating services...')
        categories_data = [
            {"name": "Massage", "description": "Massage treatments"},
            {"name": "Spa", "description": "Spa treatments"},
            {"name": "Fitness", "description": "Fitness services"},
        ]
        
        created_categories = {}
        for cat_data in categories_data:
            category, created = ServiceCategory.objects.get_or_create(
                name=cat_data["name"],
                defaults=cat_data
            )
            created_categories[cat_data["name"]] = category
        
        services_data = [
            {"name": "Swedish Massage", "description": "60-min Swedish massage", "duration_minutes": 60, "price": 80, "category": "Massage"},
            {"name": "Deep Tissue Massage", "description": "90-min deep tissue massage", "duration_minutes": 90, "price": 120, "category": "Massage"},
            {"name": "Hot Stone Massage", "description": "75-min hot stone massage", "duration_minutes": 75, "price": 100, "category": "Massage"},
            {"name": "Sauna Session", "description": "30-min sauna session", "duration_minutes": 30, "price": 30, "category": "Spa"},
            {"name": "Facial Treatment", "description": "60-min facial treatment", "duration_minutes": 60, "price": 90, "category": "Spa"},
            {"name": "Personal Training", "description": "60-min personal training session", "duration_minutes": 60, "price": 70, "category": "Fitness"},
        ]
        
        created_services = {}
        for service_data in services_data:
            service, created = Service.objects.get_or_create(
                name=service_data["name"],
                defaults={
                    "description": service_data["description"],
                    "duration_minutes": service_data["duration_minutes"],
                    "price": service_data["price"],
                    "category": created_categories[service_data["category"]],
                    "active": True,
                }
            )
            created_services[service_data["name"]] = service
        
        # Link services to locations
        created_services["Swedish Massage"].locations.set([created_locations["Room 1"]])
        created_services["Deep Tissue Massage"].locations.set([created_locations["Room 1"]])
        created_services["Hot Stone Massage"].locations.set([created_locations["Room 3"]])
        created_services["Sauna Session"].locations.set([created_locations["Room 2"]])
        created_services["Facial Treatment"].locations.set([created_locations["Room 3"]])
        created_services["Personal Training"].locations.set([created_locations["Room 4"]])
        
        self.stdout.write(self.style.SUCCESS('✅ Services created'))

        # 7. Create employees
        self.stdout.write('👨‍💼 Creating employees...')
        employees_data = [
            {
                "user": therapist_user,
                "position": therapist_role,
                "hire_date": timezone.now().date() - timedelta(days=365),
                "salary": 3500,
                "certifications": "Licensed Massage Therapist, Deep Tissue Specialist",
                "active": True,
                "services": ["Swedish Massage", "Deep Tissue Massage"]
            },
        ]
        
        created_employees = {}
        for emp_data in employees_data:
            employee, created = Employee.objects.get_or_create(
                user=emp_data["user"],
                defaults={
                    "position": emp_data["position"],
                    "hire_date": emp_data["hire_date"],
                    "salary": emp_data["salary"],
                    "certifications": emp_data["certifications"],
                    "active": emp_data["active"],
                }
            )
            # Set services
            service_objects = [created_services[svc] for svc in emp_data["services"]]
            employee.services.set(service_objects)
            created_employees[emp_data["user"].username] = employee
        
        self.stdout.write(self.style.SUCCESS('✅ Employees created'))

        # 8. Create guests with enhanced data
        self.stdout.write('👤 Creating guests...')
        guests_data = [
            {
                "membership_id": "M-1001",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "phone": "+1234567890",
                "gender": male_gender,
                "membership_tier": gold_tier,
                "loyalty_points": 1500,
                "total_spent": 2500.00,
                "visit_count": 15,
                "preferred_services": ["Swedish Massage", "Deep Tissue Massage"],
                "allergies": "None",
                "special_requirements": "Prefers firm pressure"
            },
            {
                "membership_id": "M-1002",
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane.smith@example.com",
                "phone": "+1234567891",
                "gender": female_gender,
                "membership_tier": silver_tier,
                "loyalty_points": 800,
                "total_spent": 1200.00,
                "visit_count": 8,
                "preferred_services": ["Facial Treatment", "Hot Stone Massage"],
                "allergies": "Sensitive to lavender",
                "special_requirements": "Gentle pressure preferred"
            },
            {
                "membership_id": "M-1003",
                "first_name": "Mike",
                "last_name": "Johnson",
                "email": "mike.johnson@example.com",
                "phone": "+1234567892",
                "gender": male_gender,
                "membership_tier": bronze_tier,
                "loyalty_points": 200,
                "total_spent": 300.00,
                "visit_count": 3,
                "preferred_services": ["Personal Training"],
                "allergies": "None",
                "special_requirements": "Focus on back strengthening"
            },
        ]
        
        created_guests = {}
        for guest_data in guests_data:
            guest, created = Guest.objects.get_or_create(
                membership_id=guest_data["membership_id"],
                defaults={
                    "first_name": guest_data["first_name"],
                    "last_name": guest_data["last_name"],
                    "email": guest_data["email"],
                    "phone": guest_data["phone"],
                    "gender": guest_data["gender"],
                    "membership_tier": guest_data["membership_tier"],
                    "loyalty_points": guest_data["loyalty_points"],
                    "total_spent": guest_data["total_spent"],
                    "visit_count": guest_data["visit_count"],
                    "allergies": guest_data["allergies"],
                    "special_requirements": guest_data["special_requirements"],
                }
            )
            # Set preferred services
            service_objects = [created_services[svc] for svc in guest_data["preferred_services"]]
            guest.preferred_services.set(service_objects)
            created_guests[guest_data["membership_id"]] = guest
        
        self.stdout.write(self.style.SUCCESS('✅ Guests created'))

        # 9. Create guest addresses and emergency contacts
        self.stdout.write('🏠 Creating guest addresses and emergency contacts...')
        addresses_data = [
            {"guest": "M-1001", "street_address": "123 Main St", "city": "New York", "state": "NY", "postal_code": "10001", "country": "USA"},
            {"guest": "M-1002", "street_address": "456 Oak Ave", "city": "Los Angeles", "state": "CA", "postal_code": "90210", "country": "USA"},
            {"guest": "M-1003", "street_address": "789 Pine Rd", "city": "Chicago", "state": "IL", "postal_code": "60601", "country": "USA"},
        ]
        
        for addr_data in addresses_data:
            GuestAddress.objects.get_or_create(
                guest=created_guests[addr_data["guest"]],
                defaults={
                    "street_address": addr_data["street_address"],
                    "city": addr_data["city"],
                    "state": addr_data["state"],
                    "postal_code": addr_data["postal_code"],
                    "country": addr_data["country"],
                    "is_primary": True,
                }
            )

        # Emergency contacts
        emergency_contacts_data = [
            {"guest": "M-1001", "name": "Mary Doe", "relationship": "Spouse", "phone": "+1234567893", "email": "mary.doe@example.com"},
            {"guest": "M-1002", "name": "Bob Smith", "relationship": "Brother", "phone": "+1234567894", "email": "bob.smith@example.com"},
            {"guest": "M-1003", "name": "Lisa Johnson", "relationship": "Sister", "phone": "+1234567895", "email": "lisa.johnson@example.com"},
        ]
        
        for ec_data in emergency_contacts_data:
            EmergencyContact.objects.get_or_create(
                guest=created_guests[ec_data["guest"]],
                name=ec_data["name"],
                defaults={
                    "relationship": ec_data["relationship"],
                    "phone": ec_data["phone"],
                    "email": ec_data["email"],
                }
            )
        
        self.stdout.write(self.style.SUCCESS('✅ Guest addresses and emergency contacts created'))

        # 10. Create reservations
        self.stdout.write('📅 Creating reservations...')
        
        # Create some "historical" reservations
        # NOTE: Model validation prevents creating in the past, so we schedule them in the near future
        # and mark them as completed to simulate past data.
        past_reservations = []
        for i in range(5):
            # Schedule in the next 1-3 days during business hours
            start_time = timezone.now() + timedelta(days=random.randint(1, 3))
            start_time = start_time.replace(hour=random.randint(9, 17), minute=0, second=0, microsecond=0)
            service = random.choice(list(created_services.values()))
            location = random.choice(list(created_locations.values()))
            guest = random.choice(list(created_guests.values()))
            employee = list(created_employees.values())[0]
            
            reservation = Reservation.objects.create(
                guest=guest,
                location=location,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=service.duration_minutes),
                status=Reservation.STATUS_COMPLETED,
                notes=f"Simulated past reservation {i+1} (scheduled future due to validation)",
            )
            
            # Add service to reservation
            ReservationService.objects.create(reservation=reservation, service=service)
            
            # Assign employee
            ReservationEmployeeAssignment.objects.create(
                reservation=reservation,
                employee=employee,
                role_in_service="Therapist"
            )
            
            past_reservations.append(reservation)

        # Create future reservations (explicitly future and valid)
        future_reservations = []
        for i in range(3):
            start_time = timezone.now() + timedelta(days=random.randint(2, 10))
            start_time = start_time.replace(hour=random.randint(9, 17), minute=0, second=0, microsecond=0)
            service = random.choice(list(created_services.values()))
            location = random.choice(list(created_locations.values()))
            guest = random.choice(list(created_guests.values()))
            employee = list(created_employees.values())[0]
            
            reservation = Reservation.objects.create(
                guest=guest,
                location=location,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=service.duration_minutes),
                status=Reservation.STATUS_BOOKED,
                notes=f"Future reservation {i+1}",
            )
            
            # Add service to reservation
            ReservationService.objects.create(reservation=reservation, service=service)
            
            # Assign employee
            ReservationEmployeeAssignment.objects.create(
                reservation=reservation,
                employee=employee,
                role_in_service="Therapist"
            )
            
            future_reservations.append(reservation)
        
        self.stdout.write(self.style.SUCCESS('✅ Reservations created'))

        # 11. Create invoices and payments
        self.stdout.write('💰 Creating invoices and payments...')
        invoices = []
        for reservation in past_reservations:
            service = reservation.services.first().service
            subtotal = service.price
            tax_amount = subtotal * Decimal('0.08')
            total_amount = subtotal + tax_amount
            
            invoice = Invoice.objects.create(
                guest=reservation.guest,
                reservation=reservation,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_amount=total_amount,
                status=Invoice.STATUS_PAID,
                due_date=timezone.now().date() + timedelta(days=30),
            )
            invoices.append(invoice)
            
            # Create payment
            Payment.objects.create(
                invoice=invoice,
                amount=total_amount,
                method=Payment.METHOD_CREDIT_CARD,
                status=Payment.STATUS_COMPLETED,
                processed_at=timezone.now(),
            )
        
        self.stdout.write(self.style.SUCCESS('✅ Invoices and payments created'))

        # 12. Create discount types
        self.stdout.write('🎫 Creating discount types...')
        discount_types_data = [
            {
                "name": "First Time Customer",
                "code": "FIRST10",
                "description": "10% off for first-time customers",
                "discount_method": "percentage",
                "discount_value": 10.0,
                "is_active": True,
                "requires_approval": False,
                "min_order_amount": 50.0,
                "max_discount_amount": 25.0,
                "usage_limit_per_guest": 1,
                "usage_limit_per_day": 5,
            },
            {
                "name": "Loyalty Discount",
                "code": "LOYAL15",
                "description": "15% off for loyal customers with 10+ visits",
                "discount_method": "percentage",
                "discount_value": 15.0,
                "is_active": True,
                "requires_approval": True,
                "min_order_amount": 100.0,
                "max_discount_amount": 50.0,
                "usage_limit_per_guest": 3,
                "usage_limit_per_day": 10,
            },
            {
                "name": "Senior Citizen",
                "code": "SENIOR20",
                "description": "20% off for senior citizens (65+)",
                "discount_method": "percentage",
                "discount_value": 20.0,
                "is_active": True,
                "requires_approval": False,
                "min_order_amount": 30.0,
                "max_discount_amount": 40.0,
                "usage_limit_per_guest": 5,
                "usage_limit_per_day": 15,
            },
            {
                "name": "Fixed Amount Off",
                "code": "SAVE20",
                "description": "$20 off any service over $100",
                "discount_method": "fixed_amount",
                "discount_value": 20.0,
                "is_active": True,
                "requires_approval": False,
                "min_order_amount": 100.0,
                "max_discount_amount": 20.0,
                "usage_limit_per_guest": 2,
                "usage_limit_per_day": 8,
            },
            {
                "name": "Free Service",
                "code": "FREE1",
                "description": "One free service (cheapest) with purchase over $150",
                "discount_method": "free_service",
                "discount_value": 0.0,
                "is_active": True,
                "requires_approval": True,
                "min_order_amount": 150.0,
                "max_discount_amount": 50.0,
                "usage_limit_per_guest": 1,
                "usage_limit_per_day": 3,
            },
            {
                "name": "Bulk Booking",
                "code": "BULK25",
                "description": "25% off when booking 3+ services",
                "discount_method": "percentage",
                "discount_value": 25.0,
                "is_active": True,
                "requires_approval": False,
                "min_order_amount": 200.0,
                "max_discount_amount": 100.0,
                "usage_limit_per_guest": 2,
                "usage_limit_per_day": 5,
            },
            {
                "name": "Expired Discount",
                "code": "EXPIRED",
                "description": "Expired discount for testing",
                "discount_method": "percentage",
                "discount_value": 30.0,
                "is_active": False,
                "requires_approval": False,
                "min_order_amount": 50.0,
                "max_discount_amount": 30.0,
                "usage_limit_per_guest": 1,
                "usage_limit_per_day": 1,
            },
            {
                "name": "Manager Special",
                "code": "MGR50",
                "description": "Manager's special 50% off (requires approval)",
                "discount_method": "percentage",
                "discount_value": 50.0,
                "is_active": True,
                "requires_approval": True,
                "min_order_amount": 75.0,
                "max_discount_amount": 200.0,
                "usage_limit_per_guest": 1,
                "usage_limit_per_day": 2,
            },
        ]
        
        created_discount_types = {}
        for discount_data in discount_types_data:
            discount_type, created = DiscountType.objects.get_or_create(
                code=discount_data["code"],
                defaults=discount_data
            )
            created_discount_types[discount_data["code"]] = discount_type
        
        self.stdout.write(self.style.SUCCESS('✅ Discount types created'))

        # 13. Create reservation discounts
        self.stdout.write('🎟️ Creating reservation discounts...')
        
        # Apply discounts to some reservations
        reservation_discounts_data = []
        
        # First time customer discount for John Doe
        john_guest = created_guests["M-1001"]
        john_reservations = Reservation.objects.filter(guest=john_guest)[:2]
        for i, reservation in enumerate(john_reservations):
            if i == 0:  # First reservation gets first-time discount
                discount_type = created_discount_types["FIRST10"]
                service_total = sum(rs.service.price for rs in reservation.services.all())
                discount_amount = service_total * Decimal('0.10')
                final_amount = service_total - discount_amount
                
                reservation_discount = ReservationDiscount.objects.create(
                    reservation=reservation,
                    discount_type=discount_type,
                    original_amount=service_total,
                    discount_amount=discount_amount,
                    final_amount=final_amount,
                    status='applied',
                    reason='First-time customer discount',
                    notes='Applied automatically for new customer',
                    applied_by=admin_user,
                )
                reservation_discounts_data.append(reservation_discount)
        
        # Loyalty discount for Jane Smith (has 8+ visits)
        jane_guest = created_guests["M-1002"]
        jane_reservations = Reservation.objects.filter(guest=jane_guest)[:1]
        for reservation in jane_reservations:
            discount_type = created_discount_types["LOYAL15"]
            service_total = sum(rs.service.price for rs in reservation.services.all())
            discount_amount = service_total * Decimal('0.15')
            final_amount = service_total - discount_amount
            
            reservation_discount = ReservationDiscount.objects.create(
                reservation=reservation,
                discount_type=discount_type,
                original_amount=service_total,
                discount_amount=discount_amount,
                final_amount=final_amount,
                status='pending',
                reason='Loyalty discount - requires approval',
                notes='Customer has 8+ visits, eligible for loyalty discount',
                applied_by=therapist_user,
            )
            reservation_discounts_data.append(reservation_discount)
        
        # Senior citizen discount for Mike Johnson
        mike_guest = created_guests["M-1003"]
        mike_reservations = Reservation.objects.filter(guest=mike_guest)[:1]
        for reservation in mike_reservations:
            discount_type = created_discount_types["SENIOR20"]
            service_total = sum(rs.service.price for rs in reservation.services.all())
            discount_amount = service_total * Decimal('0.20')
            final_amount = service_total - discount_amount
            
            reservation_discount = ReservationDiscount.objects.create(
                reservation=reservation,
                discount_type=discount_type,
                original_amount=service_total,
                discount_amount=discount_amount,
                final_amount=final_amount,
                status='applied',
                reason='Senior citizen discount',
                notes='Customer is 65+ years old',
                applied_by=admin_user,
            )
            reservation_discounts_data.append(reservation_discount)
        
        # Fixed amount discount for a high-value reservation
        high_value_reservations = Reservation.objects.filter(
            services__service__price__gte=100
        )[:1]
        for reservation in high_value_reservations:
            discount_type = created_discount_types["SAVE20"]
            service_total = sum(rs.service.price for rs in reservation.services.all())
            discount_amount = min(20.0, service_total)  # Fixed $20 off
            final_amount = service_total - discount_amount
            
            reservation_discount = ReservationDiscount.objects.create(
                reservation=reservation,
                discount_type=discount_type,
                original_amount=service_total,
                discount_amount=discount_amount,
                final_amount=final_amount,
                status='applied',
                reason='Fixed amount discount',
                notes='$20 off promotion',
                applied_by=manager_user,
            )
            reservation_discounts_data.append(reservation_discount)
        
        # Manager special discount (pending approval)
        manager_special_reservations = Reservation.objects.exclude(
            id__in=[rd.reservation.id for rd in reservation_discounts_data]
        )[:1]
        for reservation in manager_special_reservations:
            discount_type = created_discount_types["MGR50"]
            service_total = sum(rs.service.price for rs in reservation.services.all())
            discount_amount = service_total * Decimal('0.50')
            final_amount = service_total - discount_amount
            
            reservation_discount = ReservationDiscount.objects.create(
                reservation=reservation,
                discount_type=discount_type,
                original_amount=service_total,
                discount_amount=discount_amount,
                final_amount=final_amount,
                status='pending',
                reason='Manager special discount',
                notes='High-value customer, manager approval required',
                applied_by=therapist_user,
            )
            reservation_discounts_data.append(reservation_discount)
        
        self.stdout.write(self.style.SUCCESS('✅ Reservation discounts created'))

        # 14. Create additional test reservations with various discount scenarios
        self.stdout.write('🧪 Creating additional test reservations...')
        
        # Create a reservation with multiple services for bulk discount testing
        bulk_reservation = Reservation.objects.create(
            guest=random.choice(list(created_guests.values())),
            location=random.choice(list(created_locations.values())),
            start_time=timezone.now() + timedelta(days=2, hours=10),
            end_time=timezone.now() + timedelta(days=2, hours=13),
            status=Reservation.STATUS_BOOKED,
            notes="Bulk booking test reservation",
        )
        
        # Add multiple services
        services_for_bulk = list(created_services.values())[:3]
        for service in services_for_bulk:
            ReservationService.objects.create(reservation=bulk_reservation, service=service)
        
        # Apply bulk discount
        bulk_discount_type = created_discount_types["BULK25"]
        service_total = sum(service.price for service in services_for_bulk)
        discount_amount = service_total * Decimal('0.25')
        final_amount = service_total - discount_amount
        
        ReservationDiscount.objects.create(
            reservation=bulk_reservation,
            discount_type=bulk_discount_type,
            original_amount=service_total,
            discount_amount=discount_amount,
            final_amount=final_amount,
            status='applied',
            reason='Bulk booking discount',
            notes='3+ services booked, eligible for bulk discount',
            applied_by=admin_user,
        )
        
        # Create a reservation with free service discount
        free_service_reservation = Reservation.objects.create(
            guest=random.choice(list(created_guests.values())),
            location=random.choice(list(created_locations.values())),
            start_time=timezone.now() + timedelta(days=3, hours=14),
            end_time=timezone.now() + timedelta(days=3, hours=16),
            status=Reservation.STATUS_BOOKED,
            notes="Free service test reservation",
        )
        
        # Add services with total over $150
        expensive_services = [s for s in created_services.values() if s.price >= 80]
        for service in expensive_services[:2]:
            ReservationService.objects.create(reservation=free_service_reservation, service=service)
        
        # Apply free service discount
        free_service_discount_type = created_discount_types["FREE1"]
        service_total = sum(service.price for service in expensive_services[:2])
        cheapest_service_price = min(service.price for service in expensive_services[:2])
        discount_amount = cheapest_service_price
        final_amount = service_total - discount_amount
        
        ReservationDiscount.objects.create(
            reservation=free_service_reservation,
            discount_type=free_service_discount_type,
            original_amount=service_total,
            discount_amount=discount_amount,
            final_amount=final_amount,
            status='pending',
            reason='Free service promotion',
            notes='Purchase over $150, free cheapest service',
            applied_by=therapist_user,
        )
        
        self.stdout.write(self.style.SUCCESS('✅ Additional test reservations created'))

        # 15. Summary
        self.stdout.write('\n🎉 Sample data creation completed!')
        self.stdout.write('\n📊 Summary:')
        self.stdout.write(f'  👥 Users: {User.objects.count()}')
        self.stdout.write(f'  👤 Guests: {Guest.objects.count()}')
        self.stdout.write(f'  🏢 Locations: {Location.objects.count()}')
        self.stdout.write(f'  💆 Services: {Service.objects.count()}')
        self.stdout.write(f'  👨‍💼 Employees: {Employee.objects.count()}')
        self.stdout.write(f'  📅 Reservations: {Reservation.objects.count()}')
        self.stdout.write(f'  💰 Invoices: {Invoice.objects.count()}')
        self.stdout.write(f'  💳 Payment Methods: {PaymentMethod.objects.count()}')
        self.stdout.write(f'  🎫 Discount Types: {DiscountType.objects.count()}')
        self.stdout.write(f'  🎟️ Applied Discounts: {ReservationDiscount.objects.count()}')
        
        self.stdout.write('\n🎫 Discount Types Created:')
        for code, discount_type in created_discount_types.items():
            status = "✅ Active" if discount_type.is_active else "❌ Inactive"
            approval = "🔒 Requires Approval" if discount_type.requires_approval else "🔓 Auto-Apply"
            self.stdout.write(f'  {code}: {discount_type.name} - {status} - {approval}')
        
        self.stdout.write('\n🎟️ Applied Discounts Summary:')
        applied_count = ReservationDiscount.objects.filter(status='applied').count()
        pending_count = ReservationDiscount.objects.filter(status='pending').count()
        self.stdout.write(f'  Applied: {applied_count}')
        self.stdout.write(f'  Pending Approval: {pending_count}')
        
        self.stdout.write('\n🔑 Login credentials:')
        self.stdout.write('  Admin: admin / admin123')
        self.stdout.write('  Manager: manager1 / manager123')
        self.stdout.write('  Therapist: therapist1 / therapist123')
        
        self.stdout.write('\n🧪 Test Scenarios Available:')
        self.stdout.write('  • First-time customer discount (applied)')
        self.stdout.write('  • Loyalty discount (pending approval)')
        self.stdout.write('  • Senior citizen discount (applied)')
        self.stdout.write('  • Fixed amount discount (applied)')
        self.stdout.write('  • Manager special discount (pending approval)')
        self.stdout.write('  • Bulk booking discount (applied)')
        self.stdout.write('  • Free service discount (pending approval)')
        self.stdout.write('  • Expired discount (inactive)')
        
        self.stdout.write('\n🌐 Access the admin at: http://localhost:8000/admin/')
        self.stdout.write('🎯 Test the discount system at: http://localhost:3000/discounts')
