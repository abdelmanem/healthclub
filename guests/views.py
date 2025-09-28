from rest_framework import viewsets, filters, decorators
from rest_framework.response import Response
from reservations.models import HistoricalReservation
from reservations.serializers import HistoricalReservationSerializer
from django_filters.rest_framework import DjangoFilterBackend
from .models import Guest
from .serializers import GuestSerializer
from healthclub.permissions import ObjectPermissionsOrReadOnly

class GuestViewSet(viewsets.ModelViewSet):
    queryset = Guest.objects.all().order_by("last_name", "first_name")
    serializer_class = GuestSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "email", "phone", "membership_id"]
    ordering_fields = ["last_name", "first_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user

        return get_objects_for_user(user, 'guests.view_guest', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms

        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}

        return Response(result)

    @decorators.action(detail=True, methods=["get"], url_path="reservation-history")
    def reservation_history(self, request, pk=None):
        """Return historical reservation snapshots for this guest (most recent first)."""
        guest = self.get_object()
        qs = HistoricalReservation.objects.filter(guest_id=guest.id).order_by('-history_date', '-history_id')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = HistoricalReservationSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = HistoricalReservationSerializer(qs, many=True)
        return Response(serializer.data)

