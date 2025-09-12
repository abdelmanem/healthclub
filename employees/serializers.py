from rest_framework import serializers
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment
from services.models import Service


class EmployeeSerializer(serializers.ModelSerializer):
    services = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Service.objects.all())
    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "position",
            "hire_date",
            "salary",
            "certifications",
            "active",
            "services",
        ]

    


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


class ReservationEmployeeAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationEmployeeAssignment
        fields = ["id", "reservation", "employee", "role_in_service"]

