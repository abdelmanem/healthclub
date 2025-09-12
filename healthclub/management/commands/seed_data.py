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
from pos.models import Invoice, Payment
from config.models import MembershipTier, GenderOption


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
        
        # Create some past reservations
        past_reservations = []
        for i in range(5):
            start_time = timezone.now() - timedelta(days=random.randint(1, 30), hours=random.randint(9, 17))
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
                notes=f"Past reservation {i+1}",
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

        # Create future reservations
        future_reservations = []
        for i in range(3):
            start_time = timezone.now() + timedelta(days=random.randint(1, 7), hours=random.randint(9, 17))
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

        # 12. Summary
        self.stdout.write('\n🎉 Sample data creation completed!')
        self.stdout.write('\n📊 Summary:')
        self.stdout.write(f'  👥 Users: {User.objects.count()}')
        self.stdout.write(f'  👤 Guests: {Guest.objects.count()}')
        self.stdout.write(f'  🏢 Locations: {Location.objects.count()}')
        self.stdout.write(f'  💆 Services: {Service.objects.count()}')
        self.stdout.write(f'  👨‍💼 Employees: {Employee.objects.count()}')
        self.stdout.write(f'  📅 Reservations: {Reservation.objects.count()}')
        self.stdout.write(f'  💰 Invoices: {Invoice.objects.count()}')
        
        self.stdout.write('\n🔑 Login credentials:')
        self.stdout.write('  Admin: admin / admin123')
        self.stdout.write('  Manager: manager1 / manager123')
        self.stdout.write('  Therapist: therapist1 / therapist123')
        self.stdout.write('\n🌐 Access the admin at: http://localhost:8000/admin/')
