from rest_framework import serializers
from .models import (
    DashboardWidget, Report, ReportExecution, KPI, KPIMeasurement,
    Alert, Dashboard, DashboardWidgetPosition
)


class DashboardWidgetSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = DashboardWidget
        fields = '__all__'


class ReportSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Report
        fields = '__all__'


class ReportExecutionSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='report.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    
    class Meta:
        model = ReportExecution
        fields = '__all__'


class KPISerializer(serializers.ModelSerializer):
    class Meta:
        model = KPI
        fields = '__all__'


class KPIMeasurementSerializer(serializers.ModelSerializer):
    kpi_name = serializers.CharField(source='kpi.name', read_only=True)
    
    class Meta:
        model = KPIMeasurement
        fields = '__all__'


class AlertSerializer(serializers.ModelSerializer):
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.get_full_name', read_only=True)
    
    class Meta:
        model = Alert
        fields = '__all__'


class DashboardSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    shared_with_names = serializers.StringRelatedField(source='shared_with', many=True, read_only=True)
    
    class Meta:
        model = Dashboard
        fields = '__all__'


class DashboardWidgetPositionSerializer(serializers.ModelSerializer):
    widget_name = serializers.CharField(source='widget.name', read_only=True)
    dashboard_name = serializers.CharField(source='dashboard.name', read_only=True)
    
    class Meta:
        model = DashboardWidgetPosition
        fields = '__all__'
