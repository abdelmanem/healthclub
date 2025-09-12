from django.contrib import admin
from .models import (
    Guest, GuestAddress, EmergencyContact, GuestPreference, 
    GuestCommunication
)


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = (
        "first_name", "last_name", "email", "phone", "membership_id", 
        "membership_tier", "loyalty_points", "visit_count"
    )
    search_fields = ("first_name", "last_name", "email", "phone", "membership_id")
    list_filter = ("membership_tier", "house_status", "email_notifications", "sms_notifications")
    filter_horizontal = ("preferred_services",)


@admin.register(GuestAddress)
class GuestAddressAdmin(admin.ModelAdmin):
    list_display = ("guest", "address_type", "street_address", "city", "state", "is_primary")
    search_fields = ("street_address", "city", "state", "postal_code")
    list_filter = ("address_type", "is_primary", "country")
    list_select_related = ("guest",)


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("guest", "name", "relationship", "phone", "is_primary")
    search_fields = ("name", "phone", "relationship")
    list_filter = ("is_primary", "relationship")
    list_select_related = ("guest",)


@admin.register(GuestPreference)
class GuestPreferenceAdmin(admin.ModelAdmin):
    list_display = ("guest", "service", "rating", "created_at")
    search_fields = ("guest__first_name", "guest__last_name", "service__name")
    list_filter = ("rating", "created_at")
    list_select_related = ("guest", "service")


@admin.register(GuestCommunication)
class GuestCommunicationAdmin(admin.ModelAdmin):
    list_display = ("guest", "communication_type", "subject", "sent_at", "is_successful")
    search_fields = ("guest__first_name", "guest__last_name", "subject", "message")
    list_filter = ("communication_type", "is_successful", "response_received", "sent_at")
    list_select_related = ("guest", "sent_by")

# Register your models here.
