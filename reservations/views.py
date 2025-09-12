from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Location, Reservation
from .serializers import LocationSerializer, ReservationSerializer
from pos import create_invoice_for_reservation
from healthclub.permissions import ObjectPermissionsOrReadOnly

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
    queryset = Reservation.objects.all().select_related("guest", "location").order_by("-start_time")
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
