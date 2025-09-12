from django.contrib import admin

from .models import Location, Reservation, ReservationService


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name", "description")


class ReservationServiceInline(admin.TabularInline):
    model = ReservationService
    extra = 1


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("guest", "location", "start_time", "end_time", "status")
    list_filter = ("status", "location")
    search_fields = ("guest__first_name", "guest__last_name", "notes")
    inlines = [ReservationServiceInline]


@admin.register(ReservationService)
class ReservationServiceAdmin(admin.ModelAdmin):
    list_display = ("reservation", "service")
    list_select_related = ("reservation",)

# Register your models here.
