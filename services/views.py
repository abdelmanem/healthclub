from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Service
from .serializers import ServiceSerializer

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all().order_by("name")
    serializer_class = ServiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "duration_minutes", "price"]
    filterset_fields = {
        'locations': ['exact', 'in'],
        'price': ['gte', 'lte', 'exact'],
        'duration_minutes': ['gte', 'lte', 'exact'],
    }
