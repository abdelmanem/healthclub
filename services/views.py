from rest_framework import viewsets, filters
from .models import Service
from .serializers import ServiceSerializer

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all().order_by("name")
    serializer_class = ServiceSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "description"]
