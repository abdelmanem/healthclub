import os
from datetime import timedelta, datetime
from decimal import Decimal
import random

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "healthclub.settings")
    import django

    django.setup()

    from django.utils import timezone
    from accounts.models import Role, User
    from guests.models import Guest, GuestAddress, EmergencyContact, GuestPreference, GuestCommunication
    from services.models import Service, ServiceCategory, ServicePackage
    from reservations.models import Location, Reservation, ReservationService, RecurringPattern, Waitlist, BookingRule
    from employees.models import Employee, ReservationEmployeeAssignment, EmployeePerformance, EmployeeCommission, EmployeeTraining, EmployeeAttendance
    from pos.models import Invoice, Payment, Refund, GiftCard, PromotionalCode, FinancialReport
    from inventory.models import Supplier, ProductCategory, Product, StockMovement, PurchaseOrder, ProductServiceLink, InventoryAlert
    from marketing.models import EmailCampaign, SMSCampaign, EmailTemplate, SMSTemplate, CommunicationLog, GuestSegment, MarketingAutomation
    from analytics.models import DashboardWidget, Report, KPI, KPIMeasurement, Alert, Dashboard
    from security.models import TwoFactorAuth, PasswordPolicy, SecurityConfiguration
    from config.models import SystemConfiguration, MembershipTier, GenderOption, CommissionType, TrainingType, ProductType, BusinessRule

    print("🌱 Starting comprehensive sample data creation...")

    # 1. CONFIGURATION DATA
    print("📋 Creating configuration data...")
    
    # Initialize configurations
    from django.core.management import call_command
    call_command('init_config')
    
    # Get membership tiers
    bronze_tier = MembershipTier.objects.get(name='bronze')
    silver_tier = MembershipTier.objects.get(name='silver')
    gold_tier = MembershipTier.objects.get(name='gold')
    
    # Get gender options
    male_gender = GenderOption.objects.get(code='male')
    female_gender = GenderOption.objects.get(code='female')
    
    # Get commission types
    service_commission = CommissionType.objects.get(code='service')
    sales_commission = CommissionType.objects.get(code='sales')
    
    # Get training types
    certification_training = TrainingType.objects.get(code='certification')
    workshop_training = TrainingType.objects.get(code='workshop')
    
    # Get product types
    retail_product = ProductType.objects.get(code='retail')
    supply_product = ProductType.objects.get(code='supply')

    # 2. ROLES AND USERS
    print("👥 Creating roles and users...")
    
    therapist_role, _ = Role.objects.get_or_create(name="Therapist", defaults={"description": "Therapist role"})
    manager_role, _ = Role.objects.get_or_create(name="Manager", defaults={"description": "Manager role"})
    admin_role, _ = Role.objects.get_or_create(name="Admin", defaults={"description": "Admin role"})
    
    # Create users
    users_data = [
        {"username": "admin", "email": "admin@healthclub.com", "role": admin_role, "first_name": "Admin", "last_name": "User"},
        {"username": "manager1", "email": "manager@healthclub.com", "role": manager_role, "first_name": "Sarah", "last_name": "Manager"},
        {"username": "therapist1", "email": "therapist1@healthclub.com", "role": therapist_role, "first_name": "John", "last_name": "Therapist"},
        {"username": "therapist2", "email": "therapist2@healthclub.com", "role": therapist_role, "first_name": "Jane", "last_name": "Smith"},
    ]
    
    created_users = {}
    for user_data in users_data:
        user, created = User.objects.get_or_create(
            username=user_data["username"],
            defaults=user_data
        )
        created_users[user_data["username"]] = user

    # 3. LOCATIONS
    print("🏢 Creating locations...")
    
    locations_data = [
        {"name": "Room 1", "description": "Massage room", "capacity": 1},
        {"name": "Room 2", "description": "Sauna room", "capacity": 2},
        {"name": "Room 3", "description": "Spa treatment room", "capacity": 1},
        {"name": "Room 4", "description": "Fitness room", "capacity": 10},
        {"name": "Reception", "description": "Main reception area", "capacity": 5},
    ]
    
    created_locations = {}
    for loc_data in locations_data:
        location, created = Location.objects.get_or_create(
            name=loc_data["name"],
            defaults=loc_data
        )
        created_locations[loc_data["name"]] = location

    # 4. SERVICE CATEGORIES AND SERVICES
    print("💆 Creating service categories and services...")
    
    # Service categories
    categories_data = [
        {"name": "Massage", "description": "Various massage treatments"},
        {"name": "Spa", "description": "Spa and wellness treatments"},
        {"name": "Fitness", "description": "Fitness and exercise services"},
    ]
    
    created_categories = {}
    for cat_data in categories_data:
        category, created = ServiceCategory.objects.get_or_create(
            name=cat_data["name"],
            defaults=cat_data
        )
        created_categories[cat_data["name"]] = category

    # Services
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

    # 5. EMPLOYEES
    print("👨‍💼 Creating employees...")
    
    employees_data = [
        {
            "user": created_users["therapist1"],
            "position": therapist_role,
            "hire_date": timezone.now().date() - timedelta(days=365),
            "salary": 3500,
            "certifications": "Licensed Massage Therapist, Deep Tissue Specialist",
            "active": True,
            "services": ["Swedish Massage", "Deep Tissue Massage"]
        },
        {
            "user": created_users["therapist2"],
            "position": therapist_role,
            "hire_date": timezone.now().date() - timedelta(days=180),
            "salary": 3200,
            "certifications": "Spa Therapist, Hot Stone Specialist",
            "active": True,
            "services": ["Hot Stone Massage", "Facial Treatment", "Sauna Session"]
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

    # 6. GUESTS WITH ENHANCED DATA
    print("👤 Creating guests with enhanced data...")
    
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

    # 7. GUEST ADDRESSES AND EMERGENCY CONTACTS
    print("🏠 Creating guest addresses and emergency contacts...")
    
    # Guest addresses
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

    # 8. RESERVATIONS
    print("📅 Creating reservations...")
    
    # Create some past reservations
    past_reservations = []
    for i in range(5):
        start_time = timezone.now() - timedelta(days=random.randint(1, 30), hours=random.randint(9, 17))
        service = random.choice(list(created_services.values()))
        location = random.choice(list(created_locations.values()))
        guest = random.choice(list(created_guests.values()))
        employee = random.choice(list(created_employees.values()))
        
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
        employee = random.choice(list(created_employees.values()))
        
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

    # 9. INVOICES AND PAYMENTS
    print("💰 Creating invoices and payments...")
    
    invoices = []
    for reservation in past_reservations:
        invoice = Invoice.objects.create(
            guest=reservation.guest,
            reservation=reservation,
            subtotal=reservation.services.first().service.price,
            tax_amount=reservation.services.first().service.price * Decimal('0.08'),
            total_amount=reservation.services.first().service.price * Decimal('1.08'),
            status=Invoice.STATUS_PAID,
            due_date=timezone.now().date() + timedelta(days=30),
        )
        invoices.append(invoice)
        
        # Create payment
        Payment.objects.create(
            invoice=invoice,
            amount=invoice.total_amount,
            method=Payment.METHOD_CREDIT_CARD,
            status=Payment.STATUS_COMPLETED,
            processed_at=timezone.now(),
        )

    # 10. INVENTORY DATA
    print("📦 Creating inventory data...")
    
    # Suppliers
    suppliers_data = [
        {"name": "Spa Supplies Co", "contact_person": "John Supplier", "email": "john@spasupplies.com", "phone": "+1987654321"},
        {"name": "Wellness Products Inc", "contact_person": "Jane Supplier", "email": "jane@wellness.com", "phone": "+1987654322"},
    ]
    
    created_suppliers = {}
    for sup_data in suppliers_data:
        supplier, created = Supplier.objects.get_or_create(
            name=sup_data["name"],
            defaults=sup_data
        )
        created_suppliers[sup_data["name"]] = supplier

    # Product categories
    product_categories_data = [
        {"name": "Massage Oils", "description": "Various massage oils and lotions"},
        {"name": "Spa Equipment", "description": "Spa and wellness equipment"},
        {"name": "Towels & Linens", "description": "Towels, sheets, and linens"},
    ]
    
    created_product_categories = {}
    for pc_data in product_categories_data:
        category, created = ProductCategory.objects.get_or_create(
            name=pc_data["name"],
            defaults=pc_data
        )
        created_product_categories[pc_data["name"]] = category

    # Products
    products_data = [
        {"name": "Lavender Massage Oil", "description": "Premium lavender massage oil", "category": "Massage Oils", "supplier": "Spa Supplies Co", "cost_price": 15.00, "selling_price": 25.00, "current_stock": 50},
        {"name": "Eucalyptus Oil", "description": "Eucalyptus essential oil", "category": "Massage Oils", "supplier": "Spa Supplies Co", "cost_price": 12.00, "selling_price": 20.00, "current_stock": 30},
        {"name": "Massage Table", "description": "Professional massage table", "category": "Spa Equipment", "supplier": "Wellness Products Inc", "cost_price": 500.00, "selling_price": 800.00, "current_stock": 5},
        {"name": "Spa Towels", "description": "Premium spa towels", "category": "Towels & Linens", "supplier": "Spa Supplies Co", "cost_price": 8.00, "selling_price": 15.00, "current_stock": 100},
    ]
    
    created_products = {}
    for prod_data in products_data:
        product, created = Product.objects.get_or_create(
            name=prod_data["name"],
            defaults={
                "description": prod_data["description"],
                "category": created_product_categories[prod_data["category"]],
                "supplier": created_suppliers[prod_data["supplier"]],
                "cost_price": prod_data["cost_price"],
                "selling_price": prod_data["selling_price"],
                "current_stock": prod_data["current_stock"],
                "min_stock_level": 10,
                "max_stock_level": 100,
                "product_type": retail_product,
            }
        )
        created_products[prod_data["name"]] = product

    # 11. MARKETING DATA
    print("📧 Creating marketing data...")
    
    # Email templates
    email_templates_data = [
        {"name": "Welcome Email", "template_type": "welcome", "subject": "Welcome to Health Club!", "content": "Welcome {{guest_name}}! We're excited to have you as a member."},
        {"name": "Appointment Reminder", "template_type": "appointment_reminder", "subject": "Appointment Reminder", "content": "Hi {{guest_name}}, your appointment is tomorrow at {{appointment_time}}."},
    ]
    
    for et_data in email_templates_data:
        EmailTemplate.objects.get_or_create(
            name=et_data["name"],
            template_type=et_data["template_type"],
            defaults={
                "subject": et_data["subject"],
                "content": et_data["content"],
                "variables": ["guest_name", "appointment_time"],
            }
        )

    # SMS templates
    sms_templates_data = [
        {"name": "SMS Reminder", "template_type": "appointment_reminder", "message": "Hi {{guest_name}}, your appointment is tomorrow at {{appointment_time}}. Reply STOP to opt out."},
    ]
    
    for st_data in sms_templates_data:
        SMSTemplate.objects.get_or_create(
            name=st_data["name"],
            template_type=st_data["template_type"],
            defaults={
                "message": st_data["message"],
                "variables": ["guest_name", "appointment_time"],
            }
        )

    # Guest segments
    vip_segment = GuestSegment.objects.create(
        name="VIP Guests",
        description="High-value guests with gold or platinum membership",
        min_total_spent=1000.00,
        email_enabled=True,
        sms_enabled=True,
    )
    vip_segment.membership_tiers.set([gold_tier])

    # 12. ANALYTICS DATA
    print("📊 Creating analytics data...")
    
    # KPIs
    kpis_data = [
        {"name": "Monthly Revenue", "kpi_type": "revenue", "unit": "currency", "target_value": 50000.00},
        {"name": "Guest Satisfaction", "kpi_type": "guests", "unit": "percentage", "target_value": 95.00},
        {"name": "Employee Utilization", "kpi_type": "employees", "unit": "percentage", "target_value": 80.00},
    ]
    
    created_kpis = {}
    for kpi_data in kpis_data:
        kpi, created = KPI.objects.get_or_create(
            name=kpi_data["name"],
            defaults={
                "kpi_type": kpi_data["kpi_type"],
                "unit": kpi_data["unit"],
                "target_value": kpi_data["target_value"],
                "calculation_method": "manual",
            }
        )
        created_kpis[kpi_data["name"]] = kpi

    # Create some KPI measurements
    for kpi in created_kpis.values():
        for i in range(12):  # 12 months of data
            measurement_date = timezone.now() - timedelta(days=30*i)
            value = random.uniform(kpi.target_value * 0.8, kpi.target_value * 1.2)
            
            KPIMeasurement.objects.create(
                kpi=kpi,
                value=value,
                measured_at=measurement_date,
                period_start=measurement_date.replace(day=1),
                period_end=measurement_date.replace(day=28),
            )

    # 13. SECURITY DATA
    print("🔒 Creating security data...")
    
    # Password policy
    PasswordPolicy.objects.get_or_create(
        name="Default Password Policy",
        defaults={
            "min_length": 8,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_numbers": True,
            "require_special_chars": True,
            "prevent_reuse_count": 5,
            "expires_days": 90,
            "max_failed_attempts": 5,
            "lockout_duration_minutes": 30,
        }
    )

    # 14. BOOKING RULES
    print("📋 Creating booking rules...")
    
    BookingRule.objects.get_or_create(
        name="Standard Booking Rules",
        defaults={
            "min_advance_booking_hours": 24,
            "max_advance_booking_days": 30,
            "cancellation_deadline_hours": 24,
            "cancellation_fee_percentage": 10.00,
            "no_show_fee_percentage": 50.00,
        }
    )

    print("✅ Sample data creation completed!")
    print("\n📊 Summary of created data:")
    print(f"  👥 Users: {User.objects.count()}")
    print(f"  👤 Guests: {Guest.objects.count()}")
    print(f"  🏢 Locations: {Location.objects.count()}")
    print(f"  💆 Services: {Service.objects.count()}")
    print(f"  👨‍💼 Employees: {Employee.objects.count()}")
    print(f"  📅 Reservations: {Reservation.objects.count()}")
    print(f"  💰 Invoices: {Invoice.objects.count()}")
    print(f"  📦 Products: {Product.objects.count()}")
    print(f"  📧 Email Templates: {EmailTemplate.objects.count()}")
    print(f"  📱 SMS Templates: {SMSTemplate.objects.count()}")
    print(f"  📊 KPIs: {KPI.objects.count()}")
    print(f"  🔒 Password Policies: {PasswordPolicy.objects.count()}")
    
    print("\n🎉 All sample data has been created successfully!")
    print("You can now access the admin interface at http://localhost:8000/admin/")
    print("Login with: admin / (check your User model for password)")

if __name__ == "__main__":
    main()