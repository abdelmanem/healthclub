from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Location, Reservation, ReservationService
from .serializers import LocationSerializer, ReservationSerializer
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
    filterset_fields = { 'name': ['exact', 'icontains'] }

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
        reservation.status = Reservation.STATUS_CHECKED_IN
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status, "checked_in_at": reservation.checked_in_at})

    @decorators.action(detail=True, methods=["post"], url_path="in-service")
    def in_service(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_IN_SERVICE
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status, "in_service_at": reservation.in_service_at})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_COMPLETED
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status, "completed_at": reservation.completed_at})

    @decorators.action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_CHECKED_OUT
        reservation.save(update_fields=["status"])
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
        
    @decorators.action(detail=False, methods=["get"], url_path="availability")
    def availability(self, request):
        """Check if a location/employee/service is available at a given start time"""
        service_id = request.query_params.get("service")
        employee_id = request.query_params.get("employee")
        start_time = request.query_params.get("start")

        if not (service_id and start_time):
            return response.Response(
                {"error": "service and start are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: add your service duration lookup
        from services.models import Service
        try:
            service = Service.objects.get(pk=service_id)
        except Service.DoesNotExist:
            return response.Response({"error": "Service not found"}, status=status.HTTP_404_NOT_FOUND)

        # calculate end time
        from datetime import timedelta
        start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=service.duration_minutes)

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

        return response.Response({"available": not conflicts.exists()})

    @decorators.action(detail=False, methods=["post"], url_path="conflict-check")
    def conflict_check(self, request):
        """Check if a new reservation conflicts with existing ones"""
        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        location_id = request.data.get("location")

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

        return response.Response({"conflict": conflicts.exists()})