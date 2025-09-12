import os
from datetime import timedelta
from decimal import Decimal

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "healthclub.settings")
    import django
    django.setup()

    from django.utils import timezone
    from accounts.models import Role, User
    from guests.models import Guest
    from services.models import Service, ServiceCategory
    from reservations.models import Location, Reservation, ReservationService
    from employees.models import Employee, ReservationEmployeeAssignment
    from pos.models import Invoice, Payment
    from config.models import MembershipTier, GenderOption

    print("🌱 Starting sample data creation...")

    # 1. Initialize configurations
    print("📋 Initializing configurations...")
    from django.core.management import call_command
    try:
        call_command('init_config')
        print("✅ Configurations initialized")
    except Exception as e:
        print(f"⚠️ Configuration initialization failed: {e}")

    # 2. Get or create membership tiers
    print("👑 Creating membership tiers...")
    try:
        bronze_tier = MembershipTier.objects.get(name='bronze')
        silver_tier = MembershipTier.objects.get(name='silver')
        gold_tier = MembershipTier.objects.get(name='gold')
        print("✅ Membership tiers found")
    except Exception as e:
        print(f"⚠️ Membership tiers not found: {e}")
        # Create basic tiers if they don't exist
        bronze_tier = MembershipTier.objects.create(name='bronze', display_name='Bronze', discount_percentage=0)
        silver_tier = MembershipTier.objects.create(name='silver', display_name='Silver', discount_percentage=5)
        gold_tier = MembershipTier.objects.create(name='gold', display_name='Gold', discount_percentage=10)

    # 3. Get or create gender options
    print("⚧ Creating gender options...")
    try:
        male_gender = GenderOption.objects.get(code='male')
        female_gender = GenderOption.objects.get(code='female')
        print("✅ Gender options found")
    except Exception as e:
        print(f"⚠️ Gender options not found: {e}")
        # Create basic gender options if they don't exist
        male_gender = GenderOption.objects.create(code='male', display_name='Male')
        female_gender = GenderOption.objects.create(code='female', display_name='Female')

    # 4. Create roles and users
    print("👥 Creating roles and users...")
    therapist_role, _ = Role.objects.get_or_create(name="Therapist", defaults={"description": "Therapist role"})
    admin_role, _ = Role.objects.get_or_create(name="Admin", defaults={"description": "Admin role"})
    
    # Create admin user
    admin_user, _ = User.objects.get_or_create(
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
    admin_user.set_password("admin123")
    admin_user.save()
    
    # Create therapist user
    therapist_user, _ = User.objects.get_or_create(
        username="therapist1",
        defaults={
            "email": "therapist1@healthclub.com",
            "role": therapist_role,
            "first_name": "John",
            "last_name": "Therapist",
        }
    )
    therapist_user.set_password("therapist123")
    therapist_user.save()
    
    print("✅ Users created")

    # 5. Create locations
    print("🏢 Creating locations...")
    room1, _ = Location.objects.get_or_create(name="Room 1", defaults={"description": "Massage room", "capacity": 1})
    room2, _ = Location.objects.get_or_create(name="Room 2", defaults={"description": "Sauna room", "capacity": 2})
    print("✅ Locations created")

    # 6. Create service categories and services
    print("💆 Creating services...")
    massage_category, _ = ServiceCategory.objects.get_or_create(
        name="Massage", 
        defaults={"description": "Massage treatments"}
    )
    spa_category, _ = ServiceCategory.objects.get_or_create(
        name="Spa", 
        defaults={"description": "Spa treatments"}
    )
    
    massage, _ = Service.objects.get_or_create(
        name="Swedish Massage",
        defaults={
            "description": "60-min Swedish massage",
            "duration_minutes": 60,
            "price": 80,
            "category": massage_category,
            "active": True,
        }
    )
    sauna, _ = Service.objects.get_or_create(
        name="Sauna Session",
        defaults={
            "description": "30-min sauna session",
            "duration_minutes": 30,
            "price": 30,
            "category": spa_category,
            "active": True,
        }
    )
    
    # Link services to locations
    massage.locations.set([room1])
    sauna.locations.set([room2])
    print("✅ Services created")

    # 7. Create employee
    print("👨‍💼 Creating employee...")
    employee, _ = Employee.objects.get_or_create(
        user=therapist_user,
        position=therapist_role,
        defaults={
            "hire_date": timezone.now().date(),
            "salary": 3500,
            "certifications": "Licensed Massage Therapist",
            "active": True,
        }
    )
    employee.services.set([massage, sauna])
    print("✅ Employee created")

    # 8. Create guests
    print("👤 Creating guests...")
    guest1, _ = Guest.objects.get_or_create(
        membership_id="M-1001",
        defaults={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "+1234567890",
            "gender": male_gender,
            "membership_tier": gold_tier,
            "loyalty_points": 1500,
            "total_spent": 2500.00,
            "visit_count": 15,
        }
    )
    
    guest2, _ = Guest.objects.get_or_create(
        membership_id="M-1002",
        defaults={
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane.smith@example.com",
            "phone": "+1234567891",
            "gender": female_gender,
            "membership_tier": silver_tier,
            "loyalty_points": 800,
            "total_spent": 1200.00,
            "visit_count": 8,
        }
    )
    
    # Set preferred services
    guest1.preferred_services.set([massage])
    guest2.preferred_services.set([sauna])
    print("✅ Guests created")

    # 9. Create reservations
    print("📅 Creating reservations...")
    
    # Past reservation
    start_past = timezone.now() - timedelta(days=1, hours=2)
    end_past = start_past + timedelta(minutes=60)
    past_reservation = Reservation.objects.create(
        guest=guest1,
        location=room1,
        start_time=start_past,
        end_time=end_past,
        status=Reservation.STATUS_COMPLETED,
        notes="Completed massage session",
    )
    ReservationService.objects.create(reservation=past_reservation, service=massage)
    ReservationEmployeeAssignment.objects.create(
        reservation=past_reservation,
        employee=employee,
        role_in_service="Therapist"
    )
    
    # Future reservation
    start_future = timezone.now() + timedelta(days=1, hours=2)
    end_future = start_future + timedelta(minutes=30)
    future_reservation = Reservation.objects.create(
        guest=guest2,
        location=room2,
        start_time=start_future,
        end_time=end_future,
        status=Reservation.STATUS_BOOKED,
        notes="Upcoming sauna session",
    )
    ReservationService.objects.create(reservation=future_reservation, service=sauna)
    ReservationEmployeeAssignment.objects.create(
        reservation=future_reservation,
        employee=employee,
        role_in_service="Therapist"
    )
    print("✅ Reservations created")

    # 10. Create invoice and payment
    print("💰 Creating invoice and payment...")
    invoice = Invoice.objects.create(
        guest=guest1,
        reservation=past_reservation,
        subtotal=80.00,
        tax_amount=6.40,
        total_amount=86.40,
        status=Invoice.STATUS_PAID,
        due_date=timezone.now().date() + timedelta(days=30),
    )
    
    Payment.objects.create(
        invoice=invoice,
        amount=86.40,
        method=Payment.METHOD_CREDIT_CARD,
        status=Payment.STATUS_COMPLETED,
        processed_at=timezone.now(),
    )
    print("✅ Invoice and payment created")

    print("\n🎉 Sample data creation completed!")
    print("\n📊 Summary:")
    print(f"  👥 Users: {User.objects.count()}")
    print(f"  👤 Guests: {Guest.objects.count()}")
    print(f"  🏢 Locations: {Location.objects.count()}")
    print(f"  💆 Services: {Service.objects.count()}")
    print(f"  👨‍💼 Employees: {Employee.objects.count()}")
    print(f"  📅 Reservations: {Reservation.objects.count()}")
    print(f"  💰 Invoices: {Invoice.objects.count()}")
    
    print("\n🔑 Login credentials:")
    print("  Admin: admin / admin123")
    print("  Therapist: therapist1 / therapist123")
    print("\n🌐 Access the admin at: http://localhost:8000/admin/")

if __name__ == "__main__":
    main()
