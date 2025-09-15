from rest_framework import serializers
from .models import Location, Reservation, ReservationService


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["id", "name", "description", "capacity", "is_active"]


class ServiceDetailSerializer(serializers.Serializer):
    """Nested serializer for service details in ReservationService"""
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    duration_minutes = serializers.IntegerField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    category = serializers.CharField(source='category.name', read_only=True)


class ReservationServiceSerializer(serializers.ModelSerializer):
    service_details = ServiceDetailSerializer(source='service', read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    service_duration_minutes = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ReservationService
        fields = [
            "id", 
            "service", 
            "service_details",
            "quantity", 
            "unit_price", 
            "total_price",
            "service_duration_minutes"
        ]
        read_only_fields = ["unit_price", "total_price", "service_duration_minutes"]

    def create(self, validated_data):
        # Ensure unit_price is set from service
        service = validated_data.get('service')
        if service and not validated_data.get('unit_price'):
            validated_data['unit_price'] = service.price
        return super().create(validated_data)


class ReservationSerializer(serializers.ModelSerializer):
    reservation_services = ReservationServiceSerializer(many=True, required=False)
    guest_name = serializers.CharField(source='guest.full_name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    employee = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    total_duration_minutes = serializers.SerializerMethodField()
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "guest_name",
            "location",
            "location_name",
            "employee",
            "employee_name",
            "start_time",
            "end_time",
            "status",
            "notes",
            "reservation_services",
            "total_duration_minutes",
            "total_price",
            "checked_in_at",
            "in_service_at",
            "completed_at",
            "checked_out_at",
            "cancelled_at",
            "no_show_recorded_at",
        ]
        read_only_fields = [
            "checked_in_at",
            "in_service_at", 
            "completed_at",
            "checked_out_at",
            "cancelled_at",
            "no_show_recorded_at",
        ]

    def get_employee(self, obj):
        """Get the primary employee assigned to this reservation"""
        assignment = obj.employee_assignments.first()
        return assignment.employee.id if assignment else None

    def get_employee_name(self, obj):
        """Get the name of the primary employee assigned to this reservation"""
        assignment = obj.employee_assignments.first()
        if assignment:
            return f"{assignment.employee.user.first_name} {assignment.employee.user.last_name}".strip()
        return None

    def get_total_duration_minutes(self, obj):
        """Calculate total duration from all services"""
        total = 0
        for service in obj.reservation_services.all():
            total += service.service_duration_minutes
        return total

    def get_total_price(self, obj):
        """Calculate total price from all services"""
        total = 0
        for service in obj.reservation_services.all():
            total += service.total_price
        return total

    def create(self, validated_data):
        services_data = validated_data.pop("reservation_services", [])
        reservation = Reservation.objects.create(**validated_data)
        for srv in services_data:
            ReservationService.objects.create(reservation=reservation, **srv)
        return reservation

    def update(self, instance, validated_data):
        services_data = validated_data.pop("reservation_services", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if services_data is not None:
            instance.reservation_services.all().delete()
            for srv in services_data:
                ReservationService.objects.create(reservation=instance, **srv)
        return instance

