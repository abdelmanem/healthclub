from rest_framework import viewsets, decorators, response, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Employee, EmployeeShift, ReservationEmployeeAssignment, EmployeeWeeklySchedule, ShiftConfiguration
from .serializers import (
    EmployeeSerializer,
    EmployeeShiftSerializer,
    ReservationEmployeeAssignmentSerializer,
    EmployeeWeeklyScheduleSerializer,
    ShiftConfigurationSerializer,
)
from healthclub.permissions import ObjectPermissionsOrReadOnly

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all().select_related("user", "position").order_by("user__username")
    serializer_class = EmployeeSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["user__username", "user__first_name", "user__last_name"]
    ordering_fields = ["user__username", "hire_date"]
    filterset_fields = {
        'services': ['exact', 'in'],
        'active': ['exact'],
        'position': ['exact', 'in'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'employees.view_employee', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)


class EmployeeShiftViewSet(viewsets.ModelViewSet):
    queryset = EmployeeShift.objects.all().select_related("employee", "location").order_by("-shift_date")
    serializer_class = EmployeeShiftSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["employee__user__username", "location__name"]
    ordering_fields = ["shift_date", "start_time", "end_time"]
    filterset_fields = {
        'employee': ['exact', 'in'],
        'location': ['exact', 'in'],
        'shift_date': ['exact', 'gte', 'lte'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'employees.view_employeeshift', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

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


class EmployeeWeeklyScheduleViewSet(viewsets.ModelViewSet):
    queryset = EmployeeWeeklySchedule.objects.all().select_related('employee').order_by('employee_id', 'day_of_week')
    serializer_class = EmployeeWeeklyScheduleSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["employee__user__username"]
    ordering_fields = ["employee", "day_of_week", "effective_from"]
    filterset_fields = {
        'employee': ['exact', 'in'],
        'day_of_week': ['exact', 'in'],
        'effective_from': ['isnull', 'exact', 'gte', 'lte'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'employees.view_employeeweeklyschedule', qs)


class ReservationEmployeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ReservationEmployeeAssignment.objects.all().select_related("reservation", "employee").order_by("-id")
    serializer_class = ReservationEmployeeAssignmentSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'employees.view_reservationemployeeassignment', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

class ShiftConfigurationViewSet(viewsets.ModelViewSet):
    queryset = ShiftConfiguration.objects.all()
    serializer_class = ShiftConfigurationSerializer