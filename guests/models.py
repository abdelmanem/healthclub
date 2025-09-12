from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from simple_history.models import HistoricalRecords


class Guest(models.Model):
    GENDER_CHOICES = (
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
        ("prefer_not_to_say", "Prefer not to say"),
    )

    MEMBERSHIP_TIER_CHOICES = (
        ("bronze", "Bronze"),
        ("silver", "Silver"),
        ("gold", "Gold"),
        ("platinum", "Platinum"),
        ("vip", "VIP"),
    )

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=32, choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    medical_notes = models.TextField(blank=True)
    membership_id = models.CharField(max_length=64, unique=True)
    
    # Enhanced guest information
    membership_tier = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_TIER_CHOICES,
        default="bronze"
    )
    loyalty_points = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    visit_count = models.PositiveIntegerField(default=0)
    last_visit = models.DateTimeField(null=True, blank=True)
    
    # Communication preferences
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=True)
    marketing_emails = models.BooleanField(default=False)
    
    # Guest preferences
    preferred_services = models.ManyToManyField(
        'services.Service',
        blank=True,
        related_name='preferred_by_guests'
    )
    allergies = models.TextField(blank=True, help_text="List any allergies or dietary restrictions")
    special_requirements = models.TextField(blank=True, help_text="Any special requirements or notes")
    
    HOUSE_STATUS_CHOICES = (
        ("not_in_house", "Not in house"),
        ("in_house", "In house"),
        ("checked_out", "Checked out"),
    )
    house_status = models.CharField(
        max_length=20,
        choices=HOUSE_STATUS_CHOICES,
        default="not_in_house",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
    
    def add_loyalty_points(self, points):
        """Add loyalty points to guest"""
        self.loyalty_points += points
        self.save(update_fields=['loyalty_points'])
    
    def get_membership_benefits(self):
        """Get benefits based on membership tier"""
        benefits = {
            'bronze': {'discount': 0, 'priority_booking': False, 'free_services': 0},
            'silver': {'discount': 5, 'priority_booking': False, 'free_services': 1},
            'gold': {'discount': 10, 'priority_booking': True, 'free_services': 2},
            'platinum': {'discount': 15, 'priority_booking': True, 'free_services': 3},
            'vip': {'discount': 20, 'priority_booking': True, 'free_services': 5},
        }
        return benefits.get(self.membership_tier, benefits['bronze'])


class GuestAddress(models.Model):
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    address_type = models.CharField(
        max_length=20,
        choices=[
            ('home', 'Home'),
            ('work', 'Work'),
            ('billing', 'Billing'),
        ],
        default='home'
    )
    street_address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, default="")
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='United States')
    is_primary = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-is_primary', 'address_type']

    def __str__(self) -> str:
        return f"{self.guest.full_name} - {self.get_address_type_display()}"


class EmergencyContact(models.Model):
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='emergency_contacts'
    )
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=50)
    phone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    is_primary = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-is_primary', 'name']

    def __str__(self) -> str:
        return f"{self.guest.full_name} - {self.name} ({self.relationship})"


class GuestPreference(models.Model):
    """Model to store guest preferences for services"""
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='preferences'
    )
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.CASCADE,
        related_name='guest_preferences'
    )
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('guest', 'service')
        ordering = ['-rating', 'service__name']

    def __str__(self) -> str:
        return f"{self.guest.full_name} - {self.service.name} ({self.rating} stars)"


class GuestCommunication(models.Model):
    """Model to track all communications with guests"""
    COMMUNICATION_TYPES = (
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('phone', 'Phone Call'),
        ('in_person', 'In Person'),
    )
    
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='guest_communications'
    )
    communication_type = models.CharField(max_length=20, choices=COMMUNICATION_TYPES)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    is_successful = models.BooleanField(default=True)
    response_received = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-sent_at']

    def __str__(self) -> str:
        return f"{self.guest.full_name} - {self.get_communication_type_display()} - {self.subject}"