from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name", "description")


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email", "phone", "date_of_birth", "notes")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
        ("Role", {"fields": ("role",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2", "role"),
            },
        ),
    )
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "role")
    search_fields = ("username", "first_name", "last_name", "email")
    ordering = ("username",)

# Register your models here.
