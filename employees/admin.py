from django.contrib import admin
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment, EmployeeWeeklySchedule


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "hire_date", "active")
    list_filter = ("active", "position")
    search_fields = ("user__username", "user__first_name", "user__last_name")


@admin.register(EmployeeShift)
class EmployeeShiftAdmin(admin.ModelAdmin):
    list_display = ("employee", "shift_date", "start_time", "end_time", "location")
    list_filter = ("shift_date", "location")


@admin.register(EmployeeWeeklySchedule)
class EmployeeWeeklyScheduleAdmin(admin.ModelAdmin):
    list_display = ("employee", "day_of_week", "is_day_off", "start_time", "end_time", "effective_from")
    list_filter = ("day_of_week", "is_day_off", "effective_from")
    search_fields = ("employee__user__username",)
    list_select_related = ("employee", "location")


@admin.register(ReservationEmployeeAssignment)
class ReservationEmployeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ("reservation", "employee", "role_in_service")
    search_fields = ("reservation__id", "employee__user__username", "role_in_service")
    list_select_related = ("reservation", "employee")

# Register your models here.
