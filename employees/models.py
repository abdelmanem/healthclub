from django.db import models
from simple_history.models import HistoricalRecords


class Employee(models.Model):
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='employees',
    )
    position = models.ForeignKey(
        'accounts.Role',
        on_delete=models.CASCADE,
        related_name='employees',
    )
    hire_date = models.DateField()
    salary = models.DecimalField(max_digits=10, decimal_places=2)
    certifications = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    services = models.ManyToManyField('services.Service', related_name='employees', blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['user__username']

    def __str__(self) -> str:
        return f"{self.user} - {self.position.name}"


class EmployeeShift(models.Model):
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='shifts',
    )
    shift_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.ForeignKey(
        'reservations.Location',
        on_delete=models.CASCADE,
        related_name='employee_shifts',
    )
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-shift_date', 'start_time']
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='employee_shift_valid_range',
            )
        ]

    def __str__(self) -> str:
        return f"{self.employee} {self.shift_date} {self.start_time}-{self.end_time}"


class ReservationEmployeeAssignment(models.Model):
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='employee_assignments',
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='reservation_assignments',
    )
    role_in_service = models.CharField(max_length=150)

    history = HistoricalRecords()

    class Meta:
        unique_together = ('reservation', 'employee', 'role_in_service')

    def clean(self):
        # Ensure employee is qualified to perform at least one service in the reservation
        services_for_reservation = list(self.reservation.reservation_services.values_list('service_id', flat=True))
        qualified = self.employee.services.filter(id__in=services_for_reservation).exists()
        if not qualified:
            from django.core.exceptions import ValidationError
            raise ValidationError("Employee is not qualified for any service in this reservation.")

        # Ensure the employee has a shift covering the reservation time at the location
        from django.db.models import Q
        from datetime import datetime
        res = self.reservation
        covering_shift = self.employee.shifts.filter(
            shift_date=res.start_time.date(),
            location=res.location,
            start_time__lte=res.start_time.time(),
            end_time__gte=res.end_time.time(),
        ).exists()
        if not covering_shift:
            from django.core.exceptions import ValidationError
            raise ValidationError("No shift covers this reservation time/location for the employee.")

    def __str__(self) -> str:
        return f"{self.employee} -> {self.reservation} as {self.role_in_service}"

# Create your models here.
