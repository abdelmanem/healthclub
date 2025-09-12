from django.contrib import admin

from .models import Guest, GuestAddress, GuestEmergencyContact


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "phone", "membership_id")
    search_fields = ("first_name", "last_name", "email", "phone", "membership_id")


@admin.register(GuestAddress)
class GuestAddressAdmin(admin.ModelAdmin):
    list_display = ("guest", "street", "city", "country", "zip_code")
    search_fields = ("street", "city", "country", "zip_code")
    list_select_related = ("guest",)


@admin.register(GuestEmergencyContact)
class GuestEmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("guest", "name", "phone", "relation")
    search_fields = ("name", "phone", "relation")
    list_select_related = ("guest",)

# Register your models here.
