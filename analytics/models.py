from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from simple_history.models import HistoricalRecords
from django.contrib.auth import get_user_model

User = get_user_model()


class DashboardWidget(models.Model):
    """Configurable dashboard widgets"""
    WIDGET_TYPES = (
        ('chart', 'Chart'),
        ('metric', 'Metric'),
        ('table', 'Table'),
        ('gauge', 'Gauge'),
        ('progress', 'Progress Bar'),
        ('list', 'List'),
    )
    
    CHART_TYPES = (
        ('line', 'Line Chart'),
        ('bar', 'Bar Chart'),
        ('pie', 'Pie Chart'),
        ('doughnut', 'Doughnut Chart'),
        ('area', 'Area Chart'),
        ('scatter', 'Scatter Plot'),
    )
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    widget_type = models.CharField(max_length=20, choices=WIDGET_TYPES)
    chart_type = models.CharField(max_length=20, choices=CHART_TYPES, blank=True)
    
    # Data source configuration
    data_source = models.CharField(max_length=100, help_text="Data source identifier")
    query_params = models.JSONField(default=dict, blank=True)
    
    # Display configuration
    title = models.CharField(max_length=200)
    subtitle = models.TextField(blank=True)
    size = models.CharField(max_length=20, default='medium', choices=[
        ('small', 'Small'),
        ('medium', 'Medium'),
        ('large', 'Large'),
        ('full', 'Full Width'),
    ])
    position_x = models.PositiveIntegerField(default=0)
    position_y = models.PositiveIntegerField(default=0)
    
    # Refresh settings
    refresh_interval = models.PositiveIntegerField(default=300, help_text="Refresh interval in seconds")
    auto_refresh = models.BooleanField(default=True)
    
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_widgets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['position_y', 'position_x']
    
    def __str__(self) -> str:
        return self.name


class Report(models.Model):
    """Custom reports"""
    REPORT_TYPES = (
        ('financial', 'Financial Report'),
        ('operational', 'Operational Report'),
        ('marketing', 'Marketing Report'),
        ('inventory', 'Inventory Report'),
        ('employee', 'Employee Report'),
        ('guest', 'Guest Report'),
        ('custom', 'Custom Report'),
    )
    
    FORMATS = (
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('json', 'JSON'),
    )
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    
    # Query configuration
    data_source = models.CharField(max_length=100)
    query_params = models.JSONField(default=dict, blank=True)
    filters = models.JSONField(default=dict, blank=True)
    
    # Output configuration
    available_formats = models.JSONField(default=list, blank=True)
    default_format = models.CharField(max_length=10, choices=FORMATS, default='pdf')
    
    # Scheduling
    is_scheduled = models.BooleanField(default=False)
    schedule_cron = models.CharField(max_length=100, blank=True, help_text="Cron expression for scheduling")
    email_recipients = models.JSONField(default=list, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_reports')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class ReportExecution(models.Model):
    """Report execution history"""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )
    
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='executions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    format = models.CharField(max_length=10, choices=Report.FORMATS)
    
    # Execution details
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Output
    file_path = models.CharField(max_length=500, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    
    # Error handling
    error_message = models.TextField(blank=True)
    error_traceback = models.TextField(blank=True)
    
    # Request context
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    request_params = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self) -> str:
        return f"{self.report.name} - {self.status}"


class KPI(models.Model):
    """Key Performance Indicators"""
    KPI_TYPES = (
        ('revenue', 'Revenue'),
        ('bookings', 'Bookings'),
        ('guests', 'Guests'),
        ('employees', 'Employees'),
        ('inventory', 'Inventory'),
        ('marketing', 'Marketing'),
        ('financial', 'Financial'),
    )
    
    UNITS = (
        ('count', 'Count'),
        ('currency', 'Currency'),
        ('percentage', 'Percentage'),
        ('rate', 'Rate'),
        ('time', 'Time'),
    )
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    kpi_type = models.CharField(max_length=20, choices=KPI_TYPES)
    unit = models.CharField(max_length=20, choices=UNITS)
    
    # Calculation
    calculation_method = models.CharField(max_length=100, help_text="Method to calculate this KPI")
    calculation_params = models.JSONField(default=dict, blank=True)
    
    # Targets
    target_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    warning_threshold = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    critical_threshold = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    # Display
    display_format = models.CharField(max_length=50, default='{value}', help_text="Format string for display")
    color_scheme = models.CharField(max_length=20, default='default', choices=[
        ('default', 'Default'),
        ('green', 'Green'),
        ('red', 'Red'),
        ('blue', 'Blue'),
        ('yellow', 'Yellow'),
    ])
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['kpi_type', 'name']
    
    def __str__(self) -> str:
        return self.name


class KPIMeasurement(models.Model):
    """KPI measurement history"""
    kpi = models.ForeignKey(KPI, on_delete=models.CASCADE, related_name='measurements')
    value = models.DecimalField(max_digits=15, decimal_places=2)
    measured_at = models.DateTimeField()
    
    # Context
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    context_data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-measured_at']
        unique_together = ['kpi', 'measured_at', 'period_start', 'period_end']
    
    def __str__(self) -> str:
        return f"{self.kpi.name}: {self.value}"


class Alert(models.Model):
    """System alerts and notifications"""
    ALERT_TYPES = (
        ('kpi', 'KPI Alert'),
        ('inventory', 'Inventory Alert'),
        ('financial', 'Financial Alert'),
        ('operational', 'Operational Alert'),
        ('system', 'System Alert'),
    )
    
    SEVERITY_LEVELS = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('critical', 'Critical'),
    )
    
    name = models.CharField(max_length=200)
    description = models.TextField()
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)
    
    # Trigger conditions
    trigger_condition = models.CharField(max_length=500)
    trigger_params = models.JSONField(default=dict, blank=True)
    
    # Notification
    notification_enabled = models.BooleanField(default=True)
    email_recipients = models.JSONField(default=list, blank=True)
    sms_recipients = models.JSONField(default=list, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_triggered = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return self.name


class Dashboard(models.Model):
    """User dashboard configurations"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Layout
    layout_config = models.JSONField(default=dict, blank=True)
    widgets = models.ManyToManyField(DashboardWidget, blank=True, through='DashboardWidgetPosition')
    
    # Access control
    is_public = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_dashboards')
    shared_with = models.ManyToManyField(User, blank=True, related_name='shared_dashboards')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class DashboardWidgetPosition(models.Model):
    """Widget position within a dashboard"""
    dashboard = models.ForeignKey(Dashboard, on_delete=models.CASCADE)
    widget = models.ForeignKey(DashboardWidget, on_delete=models.CASCADE)
    position_x = models.PositiveIntegerField(default=0)
    position_y = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(default=1)
    height = models.PositiveIntegerField(default=1)
    
    class Meta:
        unique_together = ['dashboard', 'widget']
        ordering = ['position_y', 'position_x']
