from django.contrib import admin
from .models import ServiceCategory, Service, ServicePackage


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name", "description")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "duration_minutes", "price", "active")
    list_filter = ("category", "active")
    search_fields = ("name", "description")


@admin.register(ServicePackage)
class ServicePackageAdmin(admin.ModelAdmin):
    list_display = ("name", "package_price")
    search_fields = ("name", "description")

# Register your models here.
