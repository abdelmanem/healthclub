from django.db import models
from simple_history.models import HistoricalRecords


class Guest(models.Model):
    GENDER_CHOICES = (
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
        ("prefer_not_to_say", "Prefer not to say"),
    )

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=32, choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    medical_notes = models.TextField(blank=True)
    membership_id = models.CharField(max_length=64, unique=True)
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


class GuestAddress(models.Model):
    guest = models.ForeignKey(
        'Guest',
        on_delete=models.CASCADE,
        related_name='addresses',
    )
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)

    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "Guest addresses"
        ordering = ["guest", "city"]

    def __str__(self) -> str:
        return f"{self.street}, {self.city}, {self.country} {self.zip_code}"


class GuestEmergencyContact(models.Model):
    guest = models.ForeignKey(
        'Guest',
        on_delete=models.CASCADE,
        related_name='emergency_contacts',
    )
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32)
    relation = models.CharField(max_length=100)

    history = HistoricalRecords()

    class Meta:
        ordering = ["guest", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.relation})"

# Create your models here.
