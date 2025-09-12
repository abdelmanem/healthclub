from django.contrib import admin
from .models import Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "duration_minutes")
    search_fields = ("name", "description")

# Register your models here.
