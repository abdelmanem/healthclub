from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from simple_history.models import HistoricalRecords


class Location(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    capacity = models.PositiveIntegerField(default=1, help_text="Maximum number of people")
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RecurringPattern(models.Model):
    """Model to handle recurring appointment patterns"""
    FREQUENCY_CHOICES = (
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    )
    
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES)
    interval = models.PositiveIntegerField(default=1, help_text="Every X days/weeks/months")
    days_of_week = models.JSONField(default=list, blank=True, help_text="Days of week for weekly pattern")
    day_of_month = models.PositiveIntegerField(null=True, blank=True, help_text="Day of month for monthly pattern")
    end_date = models.DateField(null=True, blank=True, help_text="End date for recurring pattern")
    max_occurrences = models.PositiveIntegerField(null=True, blank=True, help_text="Maximum number of occurrences")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    def __str__(self) -> str:
        return f"{self.frequency} every {self.interval}"


class Reservation(models.Model):
    STATUS_BOOKED = "booked"
    STATUS_CHECKED_IN = "checked_in"
    STATUS_IN_SERVICE = "in_service"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_NO_SHOW = "no_show"
    STATUS_CHECKED_OUT = "checked_out"

    STATUS_CHOICES = (
        (STATUS_BOOKED, "Booked"),
        (STATUS_CHECKED_IN, "Checked in"),
        (STATUS_IN_SERVICE, "In service"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_NO_SHOW, "No show"),
        (STATUS_CHECKED_OUT, "Checked out"),
    )

    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='reservations',
    )
    location = models.ForeignKey(
        'reservations.Location',
        on_delete=models.CASCADE,
        related_name='reservations',
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_BOOKED)
    notes = models.TextField(blank=True)
    
    # Recurring appointment fields
    is_recurring = models.BooleanField(default=False)
    recurring_pattern = models.ForeignKey(
        'reservations.RecurringPattern',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reservations'
    )
    parent_reservation = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='child_reservations',
        help_text="Parent reservation for recurring appointments"
    )
    
    # status timestamps
    checked_in_at = models.DateTimeField(null=True, blank=True)
    in_service_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    checked_out_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    no_show_recorded_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-start_time"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='reservation_time_valid_range',
            )
        ]

    def __str__(self) -> str:
        return f"Reservation #{self.pk or 'new'} for {self.guest} at {self.start_time}"

    def clean(self) -> None:
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Check for booking conflicts
        if self.pk:  # Only check for existing reservations
            conflicting = Reservation.objects.filter(
                location=self.location,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
                status__in=[self.STATUS_BOOKED, self.STATUS_CHECKED_IN, self.STATUS_IN_SERVICE]
            ).exclude(pk=self.pk)
            
            if conflicting.exists():
                raise ValidationError("This time slot conflicts with an existing reservation")


def mark_guest_in_house(guest):
    """Mark guest as in house"""
    guest.house_status = 'in_house'
    guest.save(update_fields=['house_status'])


def mark_guest_checked_out(guest):
    """Mark guest as checked out"""
    guest.house_status = 'checked_out'
    guest.save(update_fields=['house_status'])


class ReservationService(models.Model):
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='reservation_services',
    )
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.CASCADE,
        related_name='reservation_services',
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    class Meta:
        unique_together = ('reservation', 'service')

    def __str__(self) -> str:
        return f"{self.reservation} - {self.service}"

    def save(self, *args, **kwargs):
        # Auto-populate unit_price from service price if not set
        if not self.unit_price and self.service:
            self.unit_price = self.service.price
        super().save(*args, **kwargs)

    @property
    def total_price(self):
        """Calculate total price for this service (unit_price * quantity)"""
        if self.unit_price:
            return self.unit_price * self.quantity
        return 0

    @property
    def service_duration_minutes(self):
        """Get service duration from the linked service"""
        return self.service.duration_minutes if self.service else 0


class Waitlist(models.Model):
    """Model to handle waitlist for fully booked slots"""
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='waitlist_entries'
    )
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.CASCADE,
        related_name='waitlist_entries'
    )
    preferred_date = models.DateField()
    preferred_time_start = models.TimeField()
    preferred_time_end = models.TimeField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_notified = models.BooleanField(default=False)
    notified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['created_at']
        unique_together = ('guest', 'service', 'preferred_date')

    def __str__(self) -> str:
        return f"{self.guest} - {self.service} on {self.preferred_date}"


class BookingRule(models.Model):
    """Model to define booking rules and policies"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Time-based rules
    min_advance_booking_hours = models.PositiveIntegerField(default=24)
    max_advance_booking_days = models.PositiveIntegerField(default=30)
    
    # Cancellation rules
    cancellation_deadline_hours = models.PositiveIntegerField(default=24)
    cancellation_fee_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # No-show rules
    no_show_fee_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name