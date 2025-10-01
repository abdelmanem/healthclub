from rest_framework import serializers
from django.db import models
from .models import Location, Reservation, ReservationService, LocationType, LocationStatus, HousekeepingTask
from datetime import timedelta
from config.models import SystemConfiguration


class LocationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationType
        fields = ["id", "name", "description", "is_active"]


class LocationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationStatus
        fields = ["id", "name", "description", "is_active"]


class LocationSerializer(serializers.ModelSerializer):
    type = LocationTypeSerializer(read_only=True)
    status = LocationStatusSerializer(read_only=True)
    type_id = serializers.PrimaryKeyRelatedField(queryset=LocationType.objects.all(), source='type', write_only=True, required=False, allow_null=True)
    status_id = serializers.PrimaryKeyRelatedField(queryset=LocationStatus.objects.all(), source='status', write_only=True, required=False, allow_null=True)
    gender = serializers.CharField()
    is_clean = serializers.BooleanField()
    is_occupied = serializers.BooleanField(read_only=True)
    is_out_of_service = serializers.BooleanField()
    class Meta:
        model = Location
        fields = ["id", "name", "description", "capacity", "is_active", "gender", "is_clean", "is_occupied", "is_out_of_service", "type", "status", "type_id", "status_id"]


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
    location_is_out_of_service = serializers.BooleanField(source='location.is_out_of_service', read_only=True)

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
            "location_is_out_of_service",
        ]
        read_only_fields = [
            "checked_in_at",
            "in_service_at", 
            "completed_at",
            "checked_out_at",
            "cancelled_at",
            "no_show_recorded_at",
        ]

    def _compute_end_time(self, start_time, services_data):
        """Compute end_time from service durations or default config."""
        total_minutes = 0
        if services_data:
            for srv in services_data:
                service = srv.get('service')
                quantity = srv.get('quantity', 1) or 1
                if service is not None:
                    try:
                        total_minutes += int(service.duration_minutes) * int(quantity)
                    except Exception:
                        pass
        if total_minutes <= 0:
            default_minutes = SystemConfiguration.get_value(
                key='default_reservation_duration_minutes',
                default=60,
                data_type='integer',
            )
            total_minutes = int(default_minutes or 60)
        return start_time + timedelta(minutes=total_minutes)

    def validate(self, attrs):
        start_time = attrs.get('start_time') or getattr(self.instance, 'start_time', None)
        end_time = attrs.get('end_time')
        services_data = attrs.get('reservation_services', [])
        guest = attrs.get('guest') or getattr(self.instance, 'guest', None)
        location = attrs.get('location') or getattr(self.instance, 'location', None)

        if not start_time:
            raise serializers.ValidationError({"start_time": "This field is required."})

        # Auto-compute end_time if missing
        if not end_time:
            attrs['end_time'] = self._compute_end_time(start_time, services_data)
        else:
            # If provided but invalid, raise a clear error instead of DB IntegrityError
            if end_time <= start_time:
                raise serializers.ValidationError({
                    "end_time": "end_time must be after start_time. Omit end_time to auto-calculate."
                })

        # Enforce room out-of-service block
        if location and getattr(location, 'is_out_of_service', False):
            raise serializers.ValidationError({
                "location": "Selected room is out of service and cannot be reserved."
            })

        # Gender constraint removed - allowing all guests to use any location

        # If only location is being updated (PATCH), ensure the slot isn't conflicting
        if self.instance and 'location' in self.initial_data and location and start_time:
            try:
                from .models import Reservation
                overlapping = Reservation.objects.filter(
                    location_id=getattr(location, 'id', None) or location,
                    start_time__lt=end_time or getattr(self.instance, 'end_time', None) or start_time,
                    end_time__gt=start_time,
                    status__in=[
                        Reservation.STATUS_BOOKED,
                        Reservation.STATUS_CHECKED_IN,
                        Reservation.STATUS_IN_SERVICE,
                    ],
                )
                if getattr(self.instance, 'id', None):
                    overlapping = overlapping.exclude(id=self.instance.id)
                if overlapping.exists():
                    raise serializers.ValidationError({
                        "location": "Selected room conflicts with another reservation at this time."
                    })
            except Exception:
                pass

        return attrs

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
        # Ensure end_time is set correctly (in case validate wasn't run for some reason)
        if not validated_data.get('end_time') and validated_data.get('start_time'):
            validated_data['end_time'] = self._compute_end_time(validated_data['start_time'], services_data)
        # Auto-assign a clean, vacant room if none provided
        if not validated_data.get('location'):
            from .models import Location
            qs = Location.objects.filter(is_active=True, is_out_of_service=False, is_clean=True, is_occupied=False)
            # Gender matching removed - allowing any available location
            # If services are provided, prefer rooms linked to those services
            service_ids = [s.get('service').id if hasattr(s.get('service'), 'id') else s.get('service') for s in services_data if s.get('service')]
            if service_ids:
                qs = qs.filter(services__in=service_ids).distinct()
            loc = qs.order_by('name').first()
            if loc:
                validated_data['location'] = loc
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


class HousekeepingTaskSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)

    class Meta:
        model = HousekeepingTask
        fields = [
            'id', 'location', 'location_name', 'reservation', 'reservation_id',
            'status', 'priority', 'due_at', 'assigned_to', 'notes', 'created_at', 'started_at',
            'completed_at', 'cancelled_at'
        ]
        read_only_fields = ['created_at', 'started_at', 'completed_at', 'cancelled_at']


class HistoricalReservationSerializer(serializers.ModelSerializer):
    """Serializer for django-simple-history snapshots of Reservation."""
    history_id = serializers.IntegerField(read_only=True)
    history_date = serializers.DateTimeField(read_only=True)
    history_type = serializers.CharField(read_only=True)
    history_user = serializers.CharField(source='history_user.username', read_only=True)
    guest_name = serializers.CharField(source='guest.full_name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        # Historical model is generated by django-simple-history
        from .models import HistoricalReservation  # local import to avoid circulars at import time
        model = HistoricalReservation
        fields = [
            'id', 'guest', 'guest_name', 'location', 'location_name', 'employee', 'employee_name',
            'start_time', 'end_time', 'status', 'notes',
            'checked_in_at', 'in_service_at', 'completed_at', 'checked_out_at',
            'cancelled_at', 'no_show_recorded_at',
            'history_id', 'history_date', 'history_type', 'history_user',
        ]

    def get_employee_name(self, obj):
        try:
            employee = getattr(obj, 'employee', None)
            if employee and getattr(employee, 'user', None):
                first = getattr(employee.user, 'first_name', '') or ''
                last = getattr(employee.user, 'last_name', '') or ''
                full = f"{first} {last}".strip()
                return full or None
        except Exception:
            pass
        return None