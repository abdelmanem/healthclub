from django.db import models
from django.contrib.auth.models import AbstractUser
from simple_history.models import HistoricalRecords


class Role(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )

    # auditing
    history = HistoricalRecords()

    class Meta:
        ordering = ["username"]

    def __str__(self) -> str:
        return self.username

# Create your models here.
