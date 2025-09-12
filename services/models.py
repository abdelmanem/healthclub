from django.db import models
from simple_history.models import HistoricalRecords


class Service(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

# Create your models here.
