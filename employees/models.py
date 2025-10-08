from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
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


class EmployeeWeeklySchedule(models.Model):
    """Default weekly schedule template per employee.
    Optionally effective from a given date; if null, it's considered the current default.
    """
    DAYS_OF_WEEK = (
        (0, 'Sunday'),
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday'),
    )

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='weekly_schedules',
    )
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    is_day_off = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    lunch_start_time = models.TimeField(null=True, blank=True)
    lunch_end_time = models.TimeField(null=True, blank=True)
    effective_from = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        unique_together = ('employee', 'day_of_week', 'effective_from')
        ordering = ['employee_id', 'day_of_week']

    def clean(self):
        # If it's not a day off, enforce times
        if not self.is_day_off:
            if not self.start_time or not self.end_time:
                from django.core.exceptions import ValidationError
                raise ValidationError('Start and end times are required unless day is off.')
            if self.end_time <= self.start_time:
                from django.core.exceptions import ValidationError
                raise ValidationError('End time must be after start time.')

    def __str__(self) -> str:
        return f"{self.employee} D{self.day_of_week} {'Off' if self.is_day_off else f'{self.start_time}-{self.end_time}'}"

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


class EmployeePerformance(models.Model):
    """Model to track employee performance metrics"""
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='performance_records'
    )
    review_period_start = models.DateField()
    review_period_end = models.DateField()
    
    # Performance metrics
    services_completed = models.PositiveIntegerField(default=0)
    customer_rating_avg = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    revenue_generated = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    commission_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    attendance_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Attendance rate percentage"
    )
    
    # Review details
    overall_rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    strengths = models.TextField(blank=True)
    areas_for_improvement = models.TextField(blank=True)
    goals = models.TextField(blank=True)
    reviewer_notes = models.TextField(blank=True)
    
    # Review tracking
    reviewed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_reviews'
    )
    review_date = models.DateField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_reviews'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-review_date']
        unique_together = ('employee', 'review_period_start', 'review_period_end')
    
    def __str__(self) -> str:
        return f"{self.employee.user.username} - {self.review_period_start} to {self.review_period_end}"


class EmployeeCommission(models.Model):
    """Model to track employee commissions"""
    COMMISSION_TYPES = (
        ('service', 'Service Commission'),
        ('sales', 'Sales Commission'),
        ('bonus', 'Performance Bonus'),
        ('overtime', 'Overtime Pay'),
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='commissions'
    )
    commission_type = models.CharField(max_length=20, choices=COMMISSION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    base_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount commission was calculated from")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Commission rate percentage")
    
    # Reference information
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_commissions'
    )
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_commissions'
    )
    
    # Payment tracking
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    earned_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-earned_date']
    
    def __str__(self) -> str:
        return f"{self.employee.user.username} - {self.get_commission_type_display()} - ${self.amount}"


class EmployeeTraining(models.Model):
    """Model to track employee training and certifications"""
    TRAINING_TYPES = (
        ('certification', 'Certification'),
        ('workshop', 'Workshop'),
        ('seminar', 'Seminar'),
        ('online', 'Online Course'),
        ('on_job', 'On-the-Job Training'),
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='trainings'
    )
    training_type = models.CharField(max_length=20, choices=TRAINING_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    provider = models.CharField(max_length=200, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    # Completion tracking
    is_completed = models.BooleanField(default=False)
    completion_date = models.DateField(null=True, blank=True)
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    certificate_number = models.CharField(max_length=100, blank=True)
    certificate_file = models.FileField(upload_to='certificates/', blank=True)
    
    # Expiry tracking
    expires_date = models.DateField(null=True, blank=True)
    is_expired = models.BooleanField(default=False)
    
    # Cost tracking
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_company_paid = models.BooleanField(default=True)
    
    # Notes
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-start_date']
    
    def __str__(self) -> str:
        return f"{self.employee.user.username} - {self.title}"
    
    def save(self, *args, **kwargs):
        # Check if training is expired
        if self.expires_date and self.completion_date:
            from django.utils import timezone
            if timezone.now().date() > self.expires_date:
                self.is_expired = True
        super().save(*args, **kwargs)


class EmployeeAttendance(models.Model):
    """Model to track employee attendance"""
    ATTENDANCE_TYPES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
        ('sick_leave', 'Sick Leave'),
        ('vacation', 'Vacation'),
        ('personal', 'Personal Leave'),
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    attendance_type = models.CharField(max_length=20, choices=ATTENDANCE_TYPES, default='present')
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    
    # Leave tracking
    leave_reason = models.TextField(blank=True)
    is_approved = models.BooleanField(default=True)
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_attendance'
    )
    
    # Notes
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
        unique_together = ('employee', 'date')
    
    def __str__(self) -> str:
        return f"{self.employee.user.username} - {self.date} - {self.get_attendance_type_display()}"

class ShiftConfiguration(models.Model):
    name = models.CharField(max_length=100, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    lunch_start_time = models.TimeField()
    lunch_end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name

# Create your models here.
