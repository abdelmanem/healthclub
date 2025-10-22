from rest_framework import serializers
from django.db import models
from .models import Location, Reservation, ReservationService, LocationType, LocationStatus, HousekeepingTask
from datetime import timedelta
from config.models import SystemConfiguration
from django.core.exceptions import ValidationError as DjangoValidationError


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
    guest_membership_tier = serializers.SerializerMethodField()
    guest_loyalty_points = serializers.IntegerField(source='guest.loyalty_points', read_only=True)
    cancellation_reason_name = serializers.CharField(source='cancellation_reason.name', read_only=True)
    deposit_status = serializers.CharField(read_only=True)
    can_pay_deposit = serializers.BooleanField(read_only=True)

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
            "deposit_required",
            "deposit_amount",
            "deposit_paid",
            "deposit_paid_at",
            "deposit_status",
            "can_pay_deposit",
            "checked_in_at",
            "in_service_at",
            "completed_at",
            "checked_out_at",
            "cancelled_at",
            "cancellation_reason",
            "cancellation_reason_name",
            "no_show_recorded_at",
            "location_is_out_of_service",
            "is_first_for_guest",
            "guest_membership_tier",
            "guest_loyalty_points",
        ]
        read_only_fields = [
            "checked_in_at",
            "in_service_at", 
            "completed_at",
            "checked_out_at",
            "cancelled_at",
            "no_show_recorded_at",
            "deposit_paid",
            "deposit_paid_at",
            "deposit_status",
            "can_pay_deposit",
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

        # Normalize datetimes to aware UTC to avoid past/future mismatches across timezones
        try:
            from django.utils import timezone
            if start_time is not None:
                if timezone.is_naive(start_time):
                    start_time = timezone.make_aware(start_time, timezone.get_current_timezone())
                start_time = start_time.astimezone(timezone.utc)
                attrs['start_time'] = start_time
            if end_time is not None:
                if timezone.is_naive(end_time):
                    end_time = timezone.make_aware(end_time, timezone.get_current_timezone())
                end_time = end_time.astimezone(timezone.utc)
                attrs['end_time'] = end_time
            # Disallow creating/updating to a past start time
            if start_time < timezone.now():
                raise serializers.ValidationError({"start_time": "Cannot create a reservation in the past."})
        except Exception:
            # Fall back to existing model-level validation if anything goes wrong
            pass

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
        """Determine the reservation's employee.

        Preference order:
        1) Explicit reservation.employee_id if present (source of truth when set)
        2) Primary Therapist assignment
        3) Any existing assignment
        """
        try:
            # 1) Prefer explicit FK on Reservation if present
            explicit_employee_id = getattr(obj, 'employee_id', None)
            if explicit_employee_id:
                return explicit_employee_id

            # 2) Primary assignment
            assignment = obj.employee_assignments.filter(role_in_service='Primary Therapist').first()
            if assignment:
                return assignment.employee.id

            # 3) Any assignment
            any_assignment = obj.employee_assignments.first()
            return any_assignment.employee.id if any_assignment else None
        except Exception:
            return None

    def get_employee_name(self, obj):
        """Resolve employee's display name using the same precedence as get_employee."""
        try:
            # 1) If explicit FK is set, use it
            explicit_employee = getattr(obj, 'employee', None)
            if explicit_employee:
                first = getattr(getattr(explicit_employee, 'user', None), 'first_name', '') or ''
                last = getattr(getattr(explicit_employee, 'user', None), 'last_name', '') or ''
                full = f"{first} {last}".strip()
                return full or None

            # 2) Primary assignment
            assignment = obj.employee_assignments.filter(role_in_service='Primary Therapist').first()
            if assignment and getattr(assignment.employee, 'user', None):
                first = getattr(assignment.employee.user, 'first_name', '') or ''
                last = getattr(assignment.employee.user, 'last_name', '') or ''
                full = f"{first} {last}".strip()
                return full or None

            # 3) Any assignment
            any_assignment = obj.employee_assignments.first()
            if any_assignment and getattr(any_assignment.employee, 'user', None):
                first = getattr(any_assignment.employee.user, 'first_name', '') or ''
                last = getattr(any_assignment.employee.user, 'last_name', '') or ''
                full = f"{first} {last}".strip()
                return full or None
        except Exception:
            pass
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

    def get_guest_membership_tier(self, obj):
        """Get guest's membership tier information"""
        try:
            guest = obj.guest
            if hasattr(guest, 'membership_tier') and guest.membership_tier:
                tier = guest.membership_tier
                return {
                    'name': tier.name,
                    'display_name': tier.display_name
                }
        except Exception:
            pass
        return None

    def create(self, validated_data):
        services_data = validated_data.pop("reservation_services", [])
        # Compute end_time before saving, based on provided services payload
        if not validated_data.get('end_time') and validated_data.get('start_time'):
            # Try to read durations directly from provided services_data to avoid touching reverse relation pre-save
            total_minutes = 0
            for srv in services_data:
                try:
                    service_obj = srv.get('service')
                    duration = None
                    if hasattr(service_obj, 'duration_minutes'):
                        duration = int(service_obj.duration_minutes)
                    elif isinstance(service_obj, int):
                        from services.models import Service
                        duration = int(Service.objects.get(pk=service_obj).duration_minutes)
                    qty = int(srv.get('quantity') or 1)
                    if duration:
                        total_minutes += duration * qty
                except Exception:
                    pass
            if total_minutes <= 0:
                validated_data['end_time'] = self._compute_end_time(validated_data['start_time'], services_data)
            else:
                validated_data['end_time'] = validated_data['start_time'] + timedelta(minutes=total_minutes)
        # Auto-assign a clean, vacant room if none provided
        if not validated_data.get('location'):
            from .models import Location
            qs = Location.objects.filter(is_active=True, is_out_of_service=False, is_clean=True, is_occupied=False)
            # Gender matching removed - allowing any available location
            # If services are provided, prefer rooms linked to those services
            service_ids = [s.get('service').id if hasattr(s.get('service'), 'id') else s.get('service') for s in services_data if s.get('service')]
            if service_ids:
                # Only filter by services if such a relation exists
                try:
                    qs = qs.filter(services__in=service_ids).distinct()
                except Exception:
                    pass
            loc = qs.order_by('name').first()
            if loc:
                validated_data['location'] = loc
        try:
            reservation = Reservation.objects.create(**validated_data)
        except DjangoValidationError as e:
            # Convert model validation errors to DRF-friendly response
            detail = getattr(e, 'message_dict', None) or {'detail': e.messages if hasattr(e, 'messages') else str(e)}
            raise serializers.ValidationError(detail)
        except Exception as e:
            raise serializers.ValidationError({'detail': str(e)})
        
        # Auto-create invoice for ALL reservations
        try:
            from pos import create_invoice_for_reservation
            from django.db import transaction
            
            with transaction.atomic():
                # Create invoice with deposit as line item if deposit is required
                include_deposit = reservation.deposit_required and reservation.deposit_amount
                invoice = create_invoice_for_reservation(
                    reservation, 
                    include_deposit_as_line_item=include_deposit
                )
        except Exception as e:
            # Don't fail reservation creation if invoice creation fails
            pass
        
        # Recompute first-for-guest flag so the earliest reservation is marked true
        try:
            self._recompute_is_first_for_guest(reservation.guest_id)
        except Exception:
            pass
        for srv in services_data:
            ReservationService.objects.create(reservation=reservation, **srv)
        return reservation

    def update(self, instance, validated_data):
        services_data = validated_data.pop("reservation_services", None)
        # track original guest before changes
        original_guest_id = getattr(instance, 'guest_id', None)
        
        # Check if deposit requirements changed
        deposit_required_changed = 'deposit_required' in validated_data
        deposit_amount_changed = 'deposit_amount' in validated_data
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.save()
        except DjangoValidationError as e:
            detail = getattr(e, 'message_dict', None) or {'detail': e.messages if hasattr(e, 'messages') else str(e)}
            raise serializers.ValidationError(detail)
        except Exception as e:
            raise serializers.ValidationError({'detail': str(e)})
        
        # Ensure invoice exists for this reservation
        try:
            from pos import create_invoice_for_reservation
            from django.db import transaction
            
            # Check if invoice already exists for this reservation
            existing_invoice = instance.invoices.filter(status__in=['draft', 'issued', 'partial']).first()
            
            if not existing_invoice:
                # Create new invoice
                with transaction.atomic():
                    include_deposit = instance.deposit_required and instance.deposit_amount
                    invoice = create_invoice_for_reservation(
                        instance, 
                        include_deposit_as_line_item=include_deposit
                    )
            elif (deposit_required_changed or deposit_amount_changed) and instance.deposit_required and instance.deposit_amount:
                # Update existing invoice - add/update deposit line item
                from pos.models import InvoiceItem
                existing_deposit_item = existing_invoice.items.filter(
                    product_name__icontains='Deposit'
                ).first()
                
                if not existing_deposit_item:
                    InvoiceItem.objects.create(
                        invoice=existing_invoice,
                        product_name=f"Deposit for Reservation #{instance.id}",
                        quantity=1,
                        unit_price=instance.deposit_amount,
                        tax_rate=0,
                        notes="Prepayment deposit"
                    )
                    existing_invoice.recalculate_totals()
                else:
                    # Update existing deposit line item
                    existing_deposit_item.unit_price = instance.deposit_amount
                    existing_deposit_item.save(update_fields=['unit_price'])
                    existing_invoice.recalculate_totals()
        except Exception as e:
            # Don't fail reservation update if invoice update fails
            pass
        
        # If guest or start_time changed, recompute flags for affected guest(s)
        try:
            affected_guest_ids = set()
            if original_guest_id and original_guest_id != getattr(instance, 'guest_id', None):
                affected_guest_ids.add(original_guest_id)
            affected_guest_ids.add(getattr(instance, 'guest_id', None))
            for gid in list(affected_guest_ids):
                if gid:
                    self._recompute_is_first_for_guest(gid)
        except Exception:
            pass
        if services_data is not None:
            instance.reservation_services.all().delete()
            for srv in services_data:
                ReservationService.objects.create(reservation=instance, **srv)
        return instance

    @staticmethod
    def _recompute_is_first_for_guest(guest_id: int):
        """Ensure exactly one reservation per guest has is_first_for_guest=True (earliest by start_time)."""
        from .models import Reservation
        qs = Reservation.objects.filter(guest_id=guest_id).order_by('start_time', 'id')
        first_id = None
        to_update = []
        for idx, r in enumerate(qs):
            should_be_first = idx == 0
            if r.is_first_for_guest != should_be_first:
                r.is_first_for_guest = should_be_first
                to_update.append(r)
            if should_be_first:
                first_id = r.id
        if to_update:
            Reservation.objects.bulk_update(to_update, ['is_first_for_guest'])


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