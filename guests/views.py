from rest_framework import viewsets, filters
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

