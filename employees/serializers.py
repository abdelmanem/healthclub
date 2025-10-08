from rest_framework import serializers
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment, EmployeeWeeklySchedule
from services.models import Service


class EmployeeSerializer(serializers.ModelSerializer):
    services = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Service.objects.all())
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "first_name",
            "last_name",
            "full_name",
            "position",
            "hire_date",
            "salary",
            "certifications",
            "active",
            "services",
        ]
    
    def get_full_name(self, obj):
        first_name = obj.user.first_name or ''
        last_name = obj.user.last_name or ''
        full_name = f"{first_name} {last_name}".strip()
        return full_name if full_name else obj.user.username

    


class EmployeeShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeShift
        fields = [
            "id",
            "employee",
            "shift_date",
            "start_time",
            "end_time",
            "location",
            "check_in_time",
            "check_out_time",
        ]


class EmployeeWeeklyScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWeeklySchedule
        fields = [
            'id', 'employee', 'day_of_week', 'is_day_off',
            'start_time', 'end_time', 'lunch_start_time', 'lunch_end_time',
            'effective_from',
        ]


class ReservationEmployeeAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationEmployeeAssignment
        fields = ["id", "reservation", "employee", "role_in_service"]

