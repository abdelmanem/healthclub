from rest_framework import viewsets, filters
from .models import Guest
from .serializers import GuestSerializer

class GuestViewSet(viewsets.ModelViewSet):
    queryset = Guest.objects.all().order_by("last_name", "first_name")
    serializer_class = GuestSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name", "email", "phone", "membership_id"]

