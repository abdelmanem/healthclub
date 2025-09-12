import os
from datetime import timedelta


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "healthclub.settings")
    import django

    django.setup()

    from django.utils import timezone
    from accounts.models import Role, User
    from guests.models import Guest
    from services.models import Service
    from reservations.models import Location, Reservation, ReservationService
    from employees.models import Employee, ReservationEmployeeAssignment

    # Locations
    room1, _ = Location.objects.get_or_create(name="Room 1", defaults={"description": "Massage room"})
    room2, _ = Location.objects.get_or_create(name="Room 2", defaults={"description": "Sauna room"})

    # Services
    massage, _ = Service.objects.get_or_create(
        name="Massage",
        defaults={"description": "60-min massage", "duration_minutes": 60, "price": 80},
    )
    sauna, _ = Service.objects.get_or_create(
        name="Sauna",
        defaults={"description": "30-min sauna", "duration_minutes": 30, "price": 30},
    )
    # Link services to locations
    massage.locations.set([room1])
    sauna.locations.set([room2])

    # Role and Employee user
    therapist_role, _ = Role.objects.get_or_create(name="Therapist", defaults={"description": "Therapist role"})
    emp_user, _ = User.objects.get_or_create(
        username="therapist1",
        defaults={"email": "therapist1@example.com", "role": therapist_role},
    )
    employee, _ = Employee.objects.get_or_create(
        user=emp_user,
        position=therapist_role,
        defaults={
            "hire_date": timezone.now().date(),
            "salary": 3000,
            "certifications": "Licensed Therapist",
            "active": True,
        },
    )
    employee.services.set([massage, sauna])

    # Guest
    guest, _ = Guest.objects.get_or_create(
        membership_id="M-1001",
        defaults={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "+100000000",
        },
    )

    # Reservation for guest in Room 1 for Massage
    start = timezone.now() + timedelta(hours=1)
    end = start + timedelta(minutes=60)
    reservation = Reservation.objects.create(
        guest=guest,
        location=room1,
        start_time=start,
        end_time=end,
        status=Reservation.STATUS_BOOKED,
        notes="First booking",
    )
    ReservationService.objects.create(reservation=reservation, service=massage)

    # Assign employee to reservation
    ReservationEmployeeAssignment.objects.get_or_create(
        reservation=reservation,
        employee=employee,
        defaults={"role_in_service": "Therapist"},
    )

    print("Created/ensured sample data:")
    print({
        "locations": {"room1": room1.id, "room2": room2.id},
        "services": {"massage": massage.id, "sauna": sauna.id},
        "guest": guest.id,
        "employee": employee.id,
        "reservation": reservation.id,
    })


if __name__ == "__main__":
    main()

