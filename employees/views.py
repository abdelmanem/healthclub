from rest_framework import viewsets, decorators, response, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment
from .serializers import (
    EmployeeSerializer,
    EmployeeShiftSerializer,
    ReservationEmployeeAssignmentSerializer,
)

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all().select_related("user", "position").order_by("user__username")
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["user__username", "user__first_name", "user__last_name"]
    ordering_fields = ["user__username", "hire_date"]
    filterset_fields = {
        'services': ['exact', 'in'],
        'active': ['exact'],
        'position': ['exact', 'in'],
    }


class EmployeeShiftViewSet(viewsets.ModelViewSet):
    queryset = EmployeeShift.objects.all().select_related("employee", "location").order_by("-shift_date")
    serializer_class = EmployeeShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["employee__user__username", "location__name"]
    ordering_fields = ["shift_date", "start_time", "end_time"]
    filterset_fields = {
        'employee': ['exact', 'in'],
        'location': ['exact', 'in'],
        'shift_date': ['exact', 'gte', 'lte'],
    }

    @decorators.action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        shift = self.get_object()
        from django.utils import timezone

        shift.check_in_time = timezone.now()
        shift.save(update_fields=["check_in_time"])
        return response.Response({"check_in_time": shift.check_in_time})

    @decorators.action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        shift = self.get_object()
        from django.utils import timezone

        shift.check_out_time = timezone.now()
        shift.save(update_fields=["check_out_time"])
        return response.Response({"check_out_time": shift.check_out_time})


class ReservationEmployeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ReservationEmployeeAssignment.objects.all().select_related("reservation", "employee").order_by("-id")
    serializer_class = ReservationEmployeeAssignmentSerializer
