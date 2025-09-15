from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import datetime, timedelta
from .models import (
    DashboardWidget, Report, ReportExecution, KPI, KPIMeasurement,
    Alert, Dashboard, DashboardWidgetPosition
)
from .serializers import (
    DashboardWidgetSerializer, ReportSerializer, ReportExecutionSerializer,
    KPISerializer, KPIMeasurementSerializer, AlertSerializer,
    DashboardSerializer, DashboardWidgetPositionSerializer
)


class DashboardWidgetViewSet(viewsets.ModelViewSet):
    queryset = DashboardWidget.objects.all()
    serializer_class = DashboardWidgetSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['widget_type', 'chart_type', 'is_active']
    search_fields = ['name', 'description', 'title']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['report_type', 'is_scheduled', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute the report"""
        report = self.get_object()
        format_type = request.data.get('format', report.default_format)
        
        if format_type not in report.available_formats:
            return Response(
                {'error': f'Format {format_type} not available for this report'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create execution record
        execution = ReportExecution.objects.create(
            report=report,
            format=format_type,
            requested_by=request.user,
            request_params=request.data
        )
        
        # TODO: Implement actual report generation logic
        # This would generate the report in the background
        
        return Response({
            'execution_id': execution.id,
            'status': execution.status,
            'message': 'Report execution initiated'
        })
    
    @action(detail=True, methods=['get'])
    def executions(self, request, pk=None):
        """Get report execution history"""
        report = self.get_object()
        executions = report.executions.all()
        
        # Apply pagination
        page = self.paginate_queryset(executions)
        if page is not None:
            serializer = ReportExecutionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = ReportExecutionSerializer(executions, many=True)
        return Response(serializer.data)


class ReportExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReportExecution.objects.all()
    serializer_class = ReportExecutionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'format', 'report']
    search_fields = ['report__name', 'error_message']
    ordering_fields = ['started_at', 'completed_at']
    ordering = ['-started_at']


class KPIViewSet(viewsets.ModelViewSet):
    queryset = KPI.objects.all()
    serializer_class = KPISerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['kpi_type', 'unit', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['kpi_type', 'name']
    
    @action(detail=True, methods=['get'])
    def measurements(self, request, pk=None):
        """Get KPI measurements"""
        kpi = self.get_object()
        measurements = kpi.measurements.all()
        
        # Apply pagination
        page = self.paginate_queryset(measurements)
        if page is not None:
            serializer = KPIMeasurementSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = KPIMeasurementSerializer(measurements, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def measure(self, request, pk=None):
        """Record a new KPI measurement"""
        kpi = self.get_object()
        
        serializer = KPIMeasurementSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(kpi=kpi)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class KPIMeasurementViewSet(viewsets.ModelViewSet):
    queryset = KPIMeasurement.objects.all()
    serializer_class = KPIMeasurementSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['kpi', 'measured_at']
    search_fields = ['kpi__name']
    ordering_fields = ['measured_at', 'value']
    ordering = ['-measured_at']


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['alert_type', 'severity', 'is_active', 'is_triggered']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'triggered_at']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert"""
        alert = self.get_object()
        alert.is_triggered = False
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.save()
        
        return Response({'message': 'Alert acknowledged'})
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active alerts"""
        active_alerts = self.get_queryset().filter(is_triggered=True, is_active=True)
        
        # Apply pagination
        page = self.paginate_queryset(active_alerts)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(active_alerts, many=True)
        return Response(serializer.data)


class DashboardViewSet(viewsets.ModelViewSet):
    queryset = Dashboard.objects.all()
    serializer_class = DashboardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_public', 'is_active', 'created_by']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['get'])
    def widgets(self, request, pk=None):
        """Get dashboard widgets"""
        dashboard = self.get_object()
        widgets = dashboard.widgets.all()
        
        # Apply pagination
        page = self.paginate_queryset(widgets)
        if page is not None:
            serializer = DashboardWidgetSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = DashboardWidgetSerializer(widgets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_widget(self, request, pk=None):
        """Add widget to dashboard"""
        dashboard = self.get_object()
        widget_id = request.data.get('widget_id')
        position_x = request.data.get('position_x', 0)
        position_y = request.data.get('position_y', 0)
        width = request.data.get('width', 1)
        height = request.data.get('height', 1)
        
        try:
            widget = DashboardWidget.objects.get(id=widget_id)
        except DashboardWidget.DoesNotExist:
            return Response(
                {'error': 'Widget not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update widget position
        position, created = DashboardWidgetPosition.objects.get_or_create(
            dashboard=dashboard,
            widget=widget,
            defaults={
                'position_x': position_x,
                'position_y': position_y,
                'width': width,
                'height': height,
            }
        )
        
        if not created:
            position.position_x = position_x
            position.position_y = position_y
            position.width = width
            position.height = height
            position.save()
        
        return Response({'message': 'Widget added to dashboard'})
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get basic dashboard statistics"""
        from guests.models import Guest
        from reservations.models import Reservation
        from services.models import Service
        from employees.models import Employee
        
        today = timezone.now().date()
        start_of_day = timezone.make_aware(datetime.combine(today, datetime.min.time()))
        end_of_day = timezone.make_aware(datetime.combine(today, datetime.max.time()))
        
        # Total guests
        total_guests = Guest.objects.count()
        
        # Today's reservations
        todays_reservations = Reservation.objects.filter(
            start_time__date=today
        ).count()
        
        # Active services
        active_services = Service.objects.filter(active=True).count()
        
        # Today's revenue
        completed_reservations = Reservation.objects.filter(
            start_time__date=today,
            status__in=['completed', 'checked_out']
        ).prefetch_related('reservation_services')
        
        todays_revenue = 0
        for reservation in completed_reservations:
            for service in reservation.reservation_services.all():
                if service.unit_price:
                    todays_revenue += service.unit_price * service.quantity
        
        # Active employees
        active_employees = Employee.objects.filter(active=True).count()
        
        # Recent reservations (last 7 days)
        week_ago = today - timedelta(days=7)
        recent_reservations = Reservation.objects.filter(
            start_time__date__gte=week_ago
        ).count()
        
        # Pending reservations
        pending_reservations = Reservation.objects.filter(
            status__in=['booked', 'confirmed']
        ).count()
        
        return Response({
            'total_guests': total_guests,
            'todays_reservations': todays_reservations,
            'active_services': active_services,
            'todays_revenue': float(todays_revenue),
            'active_employees': active_employees,
            'recent_reservations': recent_reservations,
            'pending_reservations': pending_reservations,
        })


class DashboardWidgetPositionViewSet(viewsets.ModelViewSet):
    queryset = DashboardWidgetPosition.objects.all()
    serializer_class = DashboardWidgetPositionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['dashboard', 'widget']
    ordering_fields = ['position_y', 'position_x']
    ordering = ['position_y', 'position_x']
