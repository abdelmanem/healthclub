from django.contrib import admin
from .models import (
    DashboardWidget, Report, ReportExecution, KPI, KPIMeasurement,
    Alert, Dashboard, DashboardWidgetPosition
)


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(admin.ModelAdmin):
    list_display = ('name', 'widget_type', 'chart_type', 'data_source', 'is_active', 'created_at')
    list_filter = ('widget_type', 'chart_type', 'is_active', 'created_at')
    search_fields = ('name', 'description', 'title')
    ordering = ['name']


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('name', 'report_type', 'is_scheduled', 'is_active', 'created_at')
    list_filter = ('report_type', 'is_scheduled', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    ordering = ['name']


@admin.register(ReportExecution)
class ReportExecutionAdmin(admin.ModelAdmin):
    list_display = ('report', 'status', 'format', 'started_at', 'completed_at', 'duration_seconds')
    list_filter = ('status', 'format', 'started_at')
    search_fields = ('report__name', 'error_message')
    readonly_fields = ('started_at', 'completed_at', 'duration_seconds', 'file_size')
    ordering = ['-started_at']


@admin.register(KPI)
class KPIAdmin(admin.ModelAdmin):
    list_display = ('name', 'kpi_type', 'unit', 'target_value', 'is_active', 'created_at')
    list_filter = ('kpi_type', 'unit', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    ordering = ['kpi_type', 'name']


@admin.register(KPIMeasurement)
class KPIMeasurementAdmin(admin.ModelAdmin):
    list_display = ('kpi', 'value', 'measured_at', 'period_start', 'period_end')
    list_filter = ('kpi__kpi_type', 'measured_at')
    search_fields = ('kpi__name',)
    readonly_fields = ('created_at',)
    ordering = ['-measured_at']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('name', 'alert_type', 'severity', 'is_active', 'is_triggered', 'created_at')
    list_filter = ('alert_type', 'severity', 'is_active', 'is_triggered', 'created_at')
    search_fields = ('name', 'description')
    ordering = ['-created_at']


@admin.register(Dashboard)
class DashboardAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_public', 'is_active', 'created_by', 'created_at')
    list_filter = ('is_public', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    filter_horizontal = ('shared_with',)
    ordering = ['name']


@admin.register(DashboardWidgetPosition)
class DashboardWidgetPositionAdmin(admin.ModelAdmin):
    list_display = ('dashboard', 'widget', 'position_x', 'position_y', 'width', 'height')
    list_filter = ('dashboard',)
    ordering = ['dashboard', 'position_y', 'position_x']
