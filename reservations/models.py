from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from simple_history.models import HistoricalRecords


class Location(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


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
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time.")

        # prevent overlap for same location and for same guest+location when status not cancelled/no_show
        overlapping_q = models.Q(start_time__lt=self.end_time, end_time__gt=self.start_time)
        exclude_self_q = ~models.Q(pk=self.pk) if self.pk else models.Q()
        forbidden_statuses = [
            self.STATUS_BOOKED,
            self.STATUS_CHECKED_IN,
            self.STATUS_IN_SERVICE,
            self.STATUS_COMPLETED,
            self.STATUS_CHECKED_OUT,
        ]
        # Overlap at location scope
        if Reservation.objects.filter(
            models.Q(location=self.location)
            & overlapping_q
            & exclude_self_q
            & models.Q(status__in=forbidden_statuses)
        ).exists():
            raise ValidationError("Overlapping reservation exists for this location.")

        # Overlap at service level (any service in multi-service booking)
        if self.pk:
            service_ids = list(self.reservation_services.values_list('service_id', flat=True))
        else:
            service_ids = []
        if service_ids:
            conflicting = Reservation.objects.filter(
                overlapping_q & exclude_self_q & models.Q(status__in=forbidden_statuses)
            ).filter(
                reservation_services__service_id__in=service_ids,
                location=self.location,
            ).exists()
            if conflicting:
                raise ValidationError("Overlapping reservation exists for one or more services at this location.")

        # Ensure each selected service is allowed at the chosen location
        if self.pk:
            selected_services = self.reservation_services.values_list('service_id', flat=True)
        else:
            selected_services = []
        if selected_services:
            from services.models import Service

            services_qs = Service.objects.filter(id__in=selected_services)
            for svc in services_qs:
                if not svc.locations.filter(id=self.location_id).exists():
                    raise ValidationError(f"Service '{svc.name}' is not available at location '{self.location}'.")


class ReservationService(models.Model):
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='reservation_services',
    )
    # placeholder FK to services.Service to be added later; using string ref
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.CASCADE,
        related_name='reservation_services',
    )
    history = HistoricalRecords()

    class Meta:
        unique_together = ("reservation", "service")

    def __str__(self) -> str:
        return f"{self.service} for {self.reservation}"


def mark_guest_in_house(guest):
    guest.house_status = 'in_house'
    guest.save(update_fields=['house_status'])


def mark_guest_checked_out(guest):
    guest.house_status = 'checked_out'
    guest.save(update_fields=['house_status'])

# Create your models here.
