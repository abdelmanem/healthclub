from django.contrib import admin
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "hire_date", "active")
    list_filter = ("active", "position")
    search_fields = ("user__username", "user__first_name", "user__last_name")


@admin.register(EmployeeShift)
class EmployeeShiftAdmin(admin.ModelAdmin):
    list_display = ("employee", "shift_date", "start_time", "end_time", "location")
    list_filter = ("shift_date", "location")
    search_fields = ("employee__user__username",)
    list_select_related = ("employee", "location")


@admin.register(ReservationEmployeeAssignment)
class ReservationEmployeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ("reservation", "employee", "role_in_service")
    search_fields = ("reservation__id", "employee__user__username", "role_in_service")
    list_select_related = ("reservation", "employee")

# Register your models here.
