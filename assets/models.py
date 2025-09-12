from django.db import models
from simple_history.models import HistoricalRecords


class AssetCategory(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Asset(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_MAINTENANCE = 'maintenance'
    STATUS_RETIRED = 'retired'
    STATUS_CHOICES = (
        (STATUS_ACTIVE, 'Active'),
        (STATUS_MAINTENANCE, 'Maintenance'),
        (STATUS_RETIRED, 'Retired'),
    )

    name = models.CharField(max_length=150)
    category = models.ForeignKey('assets.AssetCategory', on_delete=models.CASCADE, related_name='assets')
    purchase_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    location = models.ForeignKey('reservations.Location', on_delete=models.CASCADE, related_name='assets', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class MaintenanceLog(models.Model):
    asset = models.ForeignKey('assets.Asset', on_delete=models.CASCADE, related_name='maintenance_logs')
    description = models.TextField()
    date = models.DateField()
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-date']

    def __str__(self) -> str:
        return f"Maintenance for {self.asset} on {self.date}"

# Create your models here.
