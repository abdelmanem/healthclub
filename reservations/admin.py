from django.contrib import admin, messages
from django.utils import timezone

from .models import Location, Reservation, ReservationService
from pos import create_invoice_for_reservation


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
    actions = [
        "action_check_in",
        "action_mark_in_service",
        "action_complete",
        "action_check_out",
        "action_create_invoice",
    ]

    @admin.action(description="Check in selected reservations")
    def action_check_in(self, request, queryset):
        updated = queryset.update(status=Reservation.STATUS_CHECKED_IN)
        self.message_user(request, f"Checked in {updated} reservations.", messages.SUCCESS)

    @admin.action(description="Mark selected as In Service")
    def action_mark_in_service(self, request, queryset):
        updated = queryset.update(status=Reservation.STATUS_IN_SERVICE)
        self.message_user(request, f"Marked {updated} reservations as In Service.", messages.SUCCESS)

    @admin.action(description="Complete selected reservations")
    def action_complete(self, request, queryset):
        updated = queryset.update(status=Reservation.STATUS_COMPLETED)
        self.message_user(request, f"Completed {updated} reservations.", messages.SUCCESS)

    @admin.action(description="Check out selected reservations")
    def action_check_out(self, request, queryset):
        updated = queryset.update(status=Reservation.STATUS_CHECKED_OUT)
        self.message_user(request, f"Checked out {updated} reservations.", messages.SUCCESS)

    @admin.action(description="Create invoice for selected reservations")
    def action_create_invoice(self, request, queryset):
        created = 0
        for reservation in queryset:
            create_invoice_for_reservation(reservation)
            created += 1
        self.message_user(request, f"Created {created} invoices.", messages.SUCCESS)


@admin.register(ReservationService)
class ReservationServiceAdmin(admin.ModelAdmin):
    list_display = ("reservation", "service")
    list_select_related = ("reservation",)

# Register your models here.
