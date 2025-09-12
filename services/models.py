from django.db import models
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords


class ServiceCategory(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Service(models.Model):
    name = models.CharField(max_length=150, unique=True)
    category = models.ForeignKey('services.ServiceCategory', on_delete=models.CASCADE, related_name='services', null=True, blank=True)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    locations = models.ManyToManyField('reservations.Location', related_name='services', blank=True)
    active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ServicePackage(models.Model):
    name = models.CharField(max_length=150, unique=True)
    services = models.ManyToManyField('services.Service', related_name='packages', blank=True)
    package_price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

# Create your models here.
