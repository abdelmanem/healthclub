from django import forms
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.http import JsonResponse
from django.urls import path

from .models import Location, Reservation, ReservationService, LocationType, LocationStatus
from services.models import Service
from pos import create_invoice_for_reservation


class ReservationServiceForm(forms.ModelForm):
    class Meta:
        model = ReservationService
        fields = '__all__'
        widgets = {
            'service': forms.Select(attrs={
                'onchange': 'updateServiceDetails(this)',
                'class': 'service-select'
            }),
            'unit_price': forms.NumberInput(attrs={
                'step': '0.01',
                'onchange': 'calculateTotal(this)',
                'class': 'unit-price-input'
            }),
            'quantity': forms.NumberInput(attrs={
                'min': '1',
                'onchange': 'calculateTotal(this)',
                'class': 'quantity-input'
            })
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Avoid touching related object when not set yet
        if getattr(self.instance, 'service_id', None):
            try:
                self.fields['unit_price'].initial = self.instance.service.price
            except Exception:
                pass


class ReservationServiceInline(admin.TabularInline):
    model = ReservationService
    form = ReservationServiceForm
    extra = 1
    fields = ('service', 'service_details', 'quantity', 'unit_price', 'total_price_display')
    readonly_fields = ('service_details', 'total_price_display')
    
    def service_details(self, obj):
        """Display service details"""
        # Use service_id guard to avoid RelatedObjectDoesNotExist on empty inline rows
        if getattr(obj, 'service_id', None):
            return format_html(
                '<div class="service-details">'
                '<strong>{}</strong><br>'
                '<small>Duration: {} min | Price: ${}</small>'
                '</div>',
                obj.service.name,
                obj.service.duration_minutes,
                obj.service.price
            )
        return "-"
    service_details.short_description = "Service Details"
    
    def total_price_display(self, obj):
        """Display calculated total price"""
        if obj.unit_price and obj.quantity:
            total = obj.unit_price * obj.quantity
            return format_html('<strong>${:.2f}</strong>', total)
        return "-"
    total_price_display.short_description = "Total Price"
    
    class Media:
        js = ('admin/js/reservation_service_admin.js',)
        css = {
            'all': ('admin/css/reservation_service_admin.css',)
        }


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "capacity", "gender", "is_clean", "is_occupied", "type", "status", "is_active")
    search_fields = ("name", "description")
    list_filter = ("is_active", "type", "status", "gender", "is_clean", "is_occupied")


@admin.register(LocationType)
class LocationTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "is_active")
    search_fields = ("name", "description")
    list_filter = ("is_active",)


@admin.register(LocationStatus)
class LocationStatusAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "is_active")
    search_fields = ("name", "description")
    list_filter = ("is_active",)


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
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('get-service-details/<int:service_id>/', self.get_service_details, name='get_service_details'),
        ]
        return custom_urls + urls
    
    def get_service_details(self, request, service_id):
        """AJAX endpoint to get service details"""
        try:
            service = Service.objects.get(id=service_id)
            return JsonResponse({
                'name': service.name,
                'price': float(service.price),
                'duration_minutes': service.duration_minutes,
                'description': service.description,
                'category': service.category.name if service.category else None,
            })
        except Service.DoesNotExist:
            return JsonResponse({'error': 'Service not found'}, status=404)
    
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
    form = ReservationServiceForm
    list_display = ("reservation", "service", "service_price", "quantity", "unit_price", "total_price")
    list_select_related = ("reservation", "service")
    list_filter = ("service", "reservation__status")
    search_fields = ("reservation__guest__first_name", "reservation__guest__last_name", "service__name")
    
    def service_price(self, obj):
        """Display service price"""
        if getattr(obj, 'service_id', None):
            try:
                return f"${obj.service.price}"
            except Exception:
                return "-"
        return "-"
    service_price.short_description = "Service Price"
    
    def total_price(self, obj):
        """Display calculated total price"""
        if obj.unit_price and obj.quantity:
            total = obj.unit_price * obj.quantity
            return f"${total:.2f}"
        return "-"
    total_price.short_description = "Total Price"