from django.contrib import admin
from .models import AssetCategory, Asset, MaintenanceLog


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name", "description")


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "status", "location", "value")
    list_filter = ("category", "status")
    search_fields = ("name",)
    list_select_related = ("category", "location")


@admin.register(MaintenanceLog)
class MaintenanceLogAdmin(admin.ModelAdmin):
    list_display = ("asset", "date", "cost")
    list_filter = ("date",)
    search_fields = ("asset__name",)
    list_select_related = ("asset",)

# Register your models here.
