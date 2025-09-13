from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html
from django.db import models
from django.forms import widgets

from .models import Location, Reservation, ReservationService
from pos import create_invoice_for_reservation


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "capacity", "is_active")
    search_fields = ("name", "description")
    list_filter = ("is_active",)


class ReservationServiceInline(admin.TabularInline):
    model = ReservationService
    extra = 1
    fields = ('service', 'service_name', 'service_price', 'service_duration', 'quantity', 'unit_price', 'total_price')
    readonly_fields = ('service_name', 'service_price', 'service_duration', 'total_price')
    
    def service_name(self, obj):
        """Display service name"""
        if obj.service:
            return obj.service.name
        return "-"
    service_name.short_description = "Service Name"
    
    def service_price(self, obj):
        """Display service price"""
        if obj.service:
            return f"${obj.service.price}"
        return "-"
    service_price.short_description = "Service Price"
    
    def service_duration(self, obj):
        """Display service duration"""
        if obj.service:
            return f"{obj.service.duration_minutes} min"
        return "-"
    service_duration.short_description = "Duration"
    
    def total_price(self, obj):
        """Display calculated total price"""
        if obj.unit_price and obj.quantity:
            total = obj.unit_price * obj.quantity
            return f"${total:.2f}"
        return "-"
    total_price.short_description = "Total Price"
    
    class Media:
        js = ('admin/js/reservation_service_admin.js',)


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("id", "guest", "location", "start_time", "end_time", "status", "total_duration", "total_price")
    list_filter = ("status", "location", "start_time")
    search_fields = ("guest__first_name", "guest__last_name", "notes")
    inlines = [ReservationServiceInline]
    readonly_fields = ("checked_in_at", "in_service_at", "completed_at", "checked_out_at", "cancelled_at", "no_show_recorded_at")
    actions = [
        "action_check_in",
        "action_mark_in_service",
        "action_complete",
        "action_check_out",
        "action_create_invoice",
    ]
    
    def total_duration(self, obj):
        """Calculate total duration from all services"""
        total = 0
        for service in obj.reservation_services.all():
            total += service.service_duration_minutes
        return f"{total} min"
    total_duration.short_description = "Total Duration"
    
    def total_price(self, obj):
        """Calculate total price from all services"""
        total = 0
        for service in obj.reservation_services.all():
            total += service.total_price
        return f"${total:.2f}"
    total_price.short_description = "Total Price"

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
    list_display = ("reservation", "service", "service_price", "quantity", "unit_price", "total_price")
    list_select_related = ("reservation", "service")
    list_filter = ("service", "reservation__status")
    search_fields = ("reservation__guest__first_name", "reservation__guest__last_name", "service__name")
    
    def service_price(self, obj):
        """Display service price"""
        if obj.service:
            return f"${obj.service.price}"
        return "-"
    service_price.short_description = "Service Price"
    
    def total_price(self, obj):
        """Display calculated total price"""
        if obj.unit_price and obj.quantity:
            total = obj.unit_price * obj.quantity
            return f"${total:.2f}"
        return "-"
    total_price.short_description = "Total Price"
