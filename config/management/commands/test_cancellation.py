from django.core.management.base import BaseCommand
from config.models import CancellationReason
from reservations.models import Reservation
from guests.models import Guest
from services.models import Service
from reservations.models import Location
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Test cancellation functionality'

    def handle(self, *args, **options):
        # Check if cancellation reasons exist
        reasons = CancellationReason.objects.all()
        self.stdout.write(f"Found {reasons.count()} cancellation reasons:")
        for reason in reasons:
            self.stdout.write(f"  - {reason.code}: {reason.name}")

        # Create a test reservation if none exist
        if not Reservation.objects.exists():
            self.stdout.write("Creating test data...")
            
            # Create test guest
            guest, created = Guest.objects.get_or_create(
                first_name="Test",
                last_name="Guest",
                email="test@example.com"
            )
            
            # Create test service
            service, created = Service.objects.get_or_create(
                name="Test Service",
                defaults={
                    'description': 'Test service for cancellation',
                    'price': 50.00,
                    'duration_minutes': 60
                }
            )
            
            # Create test location
            location, created = Location.objects.get_or_create(
                name="Test Room",
                defaults={
                    'description': 'Test room for cancellation',
                    'capacity': 1
                }
            )
            
            # Create test reservation
            reservation = Reservation.objects.create(
                guest=guest,
                location=location,
                start_time=timezone.now() + timedelta(hours=1),
                end_time=timezone.now() + timedelta(hours=2),
                status='booked'
            )
            
            self.stdout.write(f"Created test reservation: {reservation}")
        else:
            reservation = Reservation.objects.first()
            self.stdout.write(f"Using existing reservation: {reservation}")

        # Test cancellation with reason
        if reservation and reasons.exists():
            reason = reasons.first()
            self.stdout.write(f"Testing cancellation with reason: {reason.name}")
            
            # Cancel the reservation
            reservation.status = Reservation.STATUS_CANCELLED
            reservation.cancelled_at = timezone.now()
            reservation.cancellation_reason = reason
            reservation.save()
            
            self.stdout.write(f"Reservation cancelled successfully!")
            self.stdout.write(f"  Status: {reservation.status}")
            self.stdout.write(f"  Cancelled at: {reservation.cancelled_at}")
            self.stdout.write(f"  Cancellation reason: {reservation.cancellation_reason}")
        else:
            self.stdout.write("No reservation or cancellation reasons found for testing")
