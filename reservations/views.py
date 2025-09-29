from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Location, Reservation, ReservationService, HousekeepingTask
from .serializers import LocationSerializer, ReservationSerializer, HousekeepingTaskSerializer
from pos import create_invoice_for_reservation
from healthclub.permissions import ObjectPermissionsOrReadOnly
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all().order_by("name")
    serializer_class = LocationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name"]
    filterset_fields = {
        'name': ['exact', 'icontains'],
        'gender': ['exact', 'in'],
        'is_clean': ['exact'],
        'is_occupied': ['exact'],
        'type': ['exact', 'in'],
        'status': ['exact', 'in'],
        'is_active': ['exact'],
        'is_out_of_service': ['exact'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'reservations.view_location', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    @decorators.action(detail=True, methods=["post"], url_path="mark-clean")
    def mark_clean(self, request, pk=None):
        obj = self.get_object()
        obj.is_clean = True
        obj.save(update_fields=["is_clean"])
        return response.Response({"id": obj.id, "is_clean": obj.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-dirty")
    def mark_dirty(self, request, pk=None):
        obj = self.get_object()
        obj.is_clean = False
        obj.save(update_fields=["is_clean"])
        return response.Response({"id": obj.id, "is_clean": obj.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-occupied")
    def mark_occupied(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = True
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="mark-vacant")
    def mark_vacant(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = False
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="out-of-service")
    def out_of_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = True
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})

    @decorators.action(detail=True, methods=["post"], url_path="back-in-service")
    def back_in_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = False
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})


class HousekeepingTaskViewSet(viewsets.ModelViewSet):
    queryset = HousekeepingTask.objects.all().select_related('location', 'reservation', 'assigned_to')
    serializer_class = HousekeepingTaskSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['location__name', 'notes']
    ordering_fields = ['created_at', 'status']
    filterset_fields = {
        'status': ['exact', 'in'],
        'location': ['exact', 'in'],
        'assigned_to': ['exact', 'in'],
        'priority': ['exact', 'in'],
    }

    @decorators.action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        if task.status not in [HousekeepingTask.STATUS_PENDING, HousekeepingTask.STATUS_CANCELLED]:
            return response.Response({"error": "Task already started or completed"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_IN_PROGRESS
        task.started_at = timezone.now()
        task.save(update_fields=["status", "started_at"])
        return response.Response({"status": task.status, "started_at": task.started_at})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.status == HousekeepingTask.STATUS_COMPLETED:
            return response.Response({"error": "Task already completed"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_COMPLETED
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_at"])
        # Mark room clean when housekeeping completes
        try:
            task.location.is_clean = True
            task.location.save(update_fields=["is_clean"])
        except Exception:
            pass
        return response.Response({"status": task.status, "completed_at": task.completed_at, "location_is_clean": task.location.is_clean})

    @decorators.action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        from django.db.models import Count, Avg, DurationField, ExpressionWrapper, F
        qs = self.get_queryset()
        counts = qs.values('status').annotate(count=Count('id'))
        # average completion time (completed_at - created_at)
        completed = qs.filter(status=HousekeepingTask.STATUS_COMPLETED, completed_at__isnull=False)
        from django.db.models.functions import Now
        duration_expr = ExpressionWrapper(F('completed_at') - F('created_at'), output_field=DurationField())
        avg_duration = completed.aggregate(avg=Avg(duration_expr)).get('avg')
        return response.Response({
            'counts': list(counts),
            'avg_completion_duration_seconds': int(avg_duration.total_seconds()) if avg_duration else None,
        })

    @decorators.action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.status == HousekeepingTask.STATUS_COMPLETED:
            return response.Response({"error": "Cannot cancel a completed task"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_CANCELLED
        task.cancelled_at = timezone.now()
        task.save(update_fields=["status", "cancelled_at"])
        return response.Response({"status": task.status, "cancelled_at": task.cancelled_at})

    @decorators.action(detail=True, methods=["post"], url_path="mark-vacant")
    def mark_vacant(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = False
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="out-of-service")
    def out_of_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = True
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})

    @decorators.action(detail=True, methods=["post"], url_path="back-in-service")
    def back_in_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = False
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().select_related(
        "guest", 
        "location"
    ).prefetch_related(
        "reservation_services__service__category"
    ).order_by("-start_time")
    serializer_class = ReservationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["guest__first_name", "guest__last_name", "notes"]
    ordering_fields = ["start_time", "end_time"]
    filterset_fields = {
        'guest': ['exact', 'in'],
        'location': ['exact', 'in'],
        'status': ['exact', 'in'],
        'start_time': ['gte', 'lte'],
        'end_time': ['gte', 'lte'],
        'reservation_services__service': ['exact', 'in'],
    }

    @decorators.action(detail=False, methods=["get"], url_path="report-utilization")
    def report_utilization(self, request):
        from django.db.models import Count
        data = self.get_queryset().values('location__name').annotate(bookings=Count('id')).order_by('-bookings')
        return response.Response(list(data))

    @decorators.action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        reservation = self.get_object()
        # Enforce room clean and not occupied before check-in
        if getattr(reservation, 'location_id', None):
            loc = reservation.location
            if getattr(loc, 'is_out_of_service', False):
                return response.Response({"error": "Room is out of service"}, status=status.HTTP_400_BAD_REQUEST)
            # If room is dirty, require explicit confirmation from frontend
            if not getattr(loc, 'is_clean', True):
                allow_dirty = False
                # support both JSON body and query param for convenience
                allow_dirty = allow_dirty or str(request.data.get('allow_dirty', '')).lower() in ['1', 'true', 'yes']
                allow_dirty = allow_dirty or str(request.query_params.get('allow_dirty', '')).lower() in ['1', 'true', 'yes']
                if not allow_dirty:
                    return response.Response(
                        {
                            "error": "Room is dirty",
                            "reason_code": "room_dirty",
                            "requires_confirmation": True,
                            "message": "Room is marked dirty. Confirm to proceed with check-in.",
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
            if getattr(loc, 'is_occupied', False):
                return response.Response(
                    {
                        "error": "Room is occupied",
                        "reason_code": "room_occupied",
                        "message": "Selected room is currently occupied. Choose another room.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        reservation.status = Reservation.STATUS_CHECKED_IN
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "checked_in_at": reservation.checked_in_at})

    @decorators.action(detail=True, methods=["post"], url_path="in-service")
    def in_service(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_IN_SERVICE
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "in_service_at": reservation.in_service_at})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_COMPLETED
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "completed_at": reservation.completed_at})

    @decorators.action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_CHECKED_OUT
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "checked_out_at": reservation.checked_out_at})

    @decorators.action(detail=True, methods=["get"], url_path="services")
    def get_services(self, request, pk=None):
        """Get detailed service information for a reservation"""
        reservation = self.get_object()
        services = []
        for rs in reservation.reservation_services.all():
            services.append({
                'id': rs.id,
                'service_id': rs.service.id,
                'service_name': rs.service.name,
                'service_description': rs.service.description,
                'service_duration_minutes': rs.service.duration_minutes,
                'service_price': rs.service.price,
                'service_category': rs.service.category.name if rs.service.category else None,
                'quantity': rs.quantity,
                'unit_price': rs.unit_price,
                'total_price': rs.total_price,
            })
        return response.Response(services)

    @decorators.action(detail=True, methods=["post"], url_path="add-service")
    def add_service(self, request, pk=None):
        """Add a service to an existing reservation"""
        reservation = self.get_object()
        service_id = request.data.get('service_id')
        quantity = request.data.get('quantity', 1)
        
        if not service_id:
            return response.Response(
                {"error": "service_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from services.models import Service
            service = Service.objects.get(id=service_id)
            
            # Check if service already exists in reservation
            existing_service = reservation.reservation_services.filter(service=service).first()
            if existing_service:
                existing_service.quantity += quantity
                existing_service.save()
                return response.Response({"message": "Service quantity updated"})
            else:
                ReservationService.objects.create(
                    reservation=reservation,
                    service=service,
                    quantity=quantity
                )
                return response.Response({"message": "Service added to reservation"})
                
        except Service.DoesNotExist:
            return response.Response(
                {"error": "Service not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @decorators.action(detail=True, methods=["post"], url_path="create-invoice")
    def create_invoice(self, request, pk=None):
        reservation = self.get_object()
        invoice = create_invoice_for_reservation(reservation)
        return response.Response({"invoice_id": invoice.id, "invoice_number": invoice.invoice_number}, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user

        return get_objects_for_user(user, 'reservations.view_reservation', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms

        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    @decorators.action(detail=True, methods=["post"], url_path="grant", permission_classes=[ObjectPermissionsOrReadOnly])
    def grant(self, request, pk=None):
        reservation = self.get_object()
        from guardian.shortcuts import assign_perm
        username = request.data.get("username")
        perm = request.data.get("perm", "change_reservation")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return response.Response({"detail": "User not found"}, status=status.HTTP_400_BAD_REQUEST)
        assign_perm(perm, user, reservation)
        return response.Response({"granted": perm, "to": username})

    @decorators.action(detail=True, methods=["post"], url_path="revoke", permission_classes=[ObjectPermissionsOrReadOnly])
    def revoke(self, request, pk=None):
        reservation = self.get_object()
        from guardian.shortcuts import remove_perm
        username = request.data.get("username")
        perm = request.data.get("perm", "change_reservation")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return response.Response({"detail": "User not found"}, status=status.HTTP_400_BAD_REQUEST)
        remove_perm(perm, user, reservation)
        return response.Response({"revoked": perm, "from": username})
    
    @decorators.action(detail=True, methods=["post"], url_path="mark-clean")
    def mark_clean(self, request, pk=None):
        reservation = self.get_object()
        if not getattr(reservation, 'location_id', None):
            return response.Response({"error": "Reservation has no location"}, status=status.HTTP_400_BAD_REQUEST)
        loc = reservation.location
        loc.is_clean = True
        loc.save(update_fields=["is_clean"])
        return response.Response({"location_id": loc.id, "is_clean": loc.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-dirty")
    def mark_dirty(self, request, pk=None):
        reservation = self.get_object()
        if not getattr(reservation, 'location_id', None):
            return response.Response({"error": "Reservation has no location"}, status=status.HTTP_400_BAD_REQUEST)
        loc = reservation.location
        loc.is_clean = False
        loc.save(update_fields=["is_clean"])
        return response.Response({"location_id": loc.id, "is_clean": loc.is_clean})
        
    @decorators.action(detail=False, methods=["get"], url_path="availability")
    def availability(self, request):
        """Check if a location/employee/service is available at a given start time"""
        service_id = request.query_params.get("service")
        services_param = request.query_params.getlist("services") if hasattr(request.query_params, 'getlist') else None
        employee_id = request.query_params.get("employee")
        start_time = request.query_params.get("start")
        location_id = request.query_params.get("location")

        if not (service_id and start_time):
            return response.Response(
                {"error": "service and start are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: add your service duration lookup
        from services.models import Service
        try:
            if services_param:
                services_qs = Service.objects.filter(pk__in=services_param)
                services = list(services_qs)
                if not services:
                    return response.Response({"error": "Services not found"}, status=status.HTTP_404_NOT_FOUND)
                # use max duration among selected services
                duration_minutes = max([s.duration_minutes for s in services] or [60])
            else:
                service = Service.objects.get(pk=service_id)
                services = [service]
                duration_minutes = service.duration_minutes
        except Service.DoesNotExist:
            return response.Response({"error": "Service not found"}, status=status.HTTP_404_NOT_FOUND)

        # calculate end time
        from datetime import timedelta
        start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        # check conflicts
        conflicts = Reservation.objects.filter(
            start_time__lt=end_dt,
            end_time__gt=start_dt,
            status__in=[
                Reservation.STATUS_BOOKED,
                Reservation.STATUS_CHECKED_IN,
                Reservation.STATUS_IN_SERVICE,
            ],
        )

        if employee_id:
            conflicts = conflicts.filter(reservation_services__employee_id=employee_id)
        if location_id:
            conflicts = conflicts.filter(location_id=location_id)

        # Exclude current reservation when editing
        exclude_reservation = request.query_params.get("exclude_reservation")
        if exclude_reservation:
            try:
                conflicts = conflicts.exclude(pk=int(exclude_reservation))
            except Exception:
                pass

        # Block out-of-service and validate compatibility/capacity
        if location_id:
            try:
                loc = Location.objects.get(pk=location_id)
            except Location.DoesNotExist:
                return response.Response({"available": False, "reason": "invalid_location"})

            if getattr(loc, 'is_out_of_service', False):
                return response.Response({"available": False, "reason": "out_of_service"})

            # service compatibility: service must be allowed in location
            try:
                compat_all = all([s.locations.filter(pk=loc.pk).exists() for s in services])
            except Exception:
                compat_all = False
            if not compat_all:
                return response.Response({"available": False, "reason": "incompatible_room"})

            # capacity-aware availability
            overlap_count = conflicts.count()
            capacity = getattr(loc, 'capacity', 1) or 1
            is_available = overlap_count < capacity
            payload = {"available": is_available, "overlaps": overlap_count, "capacity": capacity}
            if not is_available:
                payload.update({"reason": "capacity_reached"})
            return response.Response(payload)

        return response.Response({"available": not conflicts.exists()})

    @decorators.action(detail=False, methods=["post"], url_path="conflict-check")
    def conflict_check(self, request):
        """Check if a new reservation conflicts with existing ones"""
        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        location_id = request.data.get("location")
        exclude_reservation = request.data.get("exclude_reservation")
        service_id = request.data.get("service")
        services_list = request.data.get("services")

        if not (start_time and end_time and location_id):
            return response.Response(
                {"error": "start_time, end_time, and location are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = timezone.datetime.fromisoformat(end_time.replace("Z", "+00:00"))

        conflicts = Reservation.objects.filter(
            location_id=location_id,
            start_time__lt=end_dt,
            end_time__gt=start_dt,
            status__in=[
                Reservation.STATUS_BOOKED,
                Reservation.STATUS_CHECKED_IN,
                Reservation.STATUS_IN_SERVICE,
            ],
        )
        if exclude_reservation:
            try:
                conflicts = conflicts.exclude(pk=int(exclude_reservation))
            except Exception:
                pass

        # Validate location & service compatibility and capacity-aware conflicts
        try:
            loc = Location.objects.get(pk=location_id)
        except Location.DoesNotExist:
            return response.Response({"conflict": True, "reason": "invalid_location"})

        if getattr(loc, 'is_out_of_service', False):
            return response.Response({"conflict": True, "reason": "out_of_service"})

        # service compatibility: all services must be allowed in location
        try:
            from services.models import Service
            if services_list and isinstance(services_list, list):
                svcs = Service.objects.filter(pk__in=services_list)
                if not all([s.locations.filter(pk=loc.pk).exists() for s in svcs]):
                    return response.Response({"conflict": True, "reason": "incompatible_room"})
            elif service_id:
                svc = Service.objects.get(pk=int(service_id))
                if not svc.locations.filter(pk=loc.pk).exists():
                    return response.Response({"conflict": True, "reason": "incompatible_room"})
        except Service.DoesNotExist:
            return response.Response({"conflict": True, "reason": "invalid_service"})
        except Exception:
            return response.Response({"conflict": True, "reason": "invalid_service"})

        overlap_count = conflicts.count()
        capacity = getattr(loc, 'capacity', 1) or 1
        is_conflict = overlap_count >= capacity
        payload = {"conflict": is_conflict, "overlaps": overlap_count, "capacity": capacity}
        if is_conflict:
            payload.update({"reason": "capacity_reached"})
        return response.Response(payload)