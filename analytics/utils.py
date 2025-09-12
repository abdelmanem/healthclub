"""
Analytics utility functions for accessing configurations
"""
from config.utils import get_config


def get_dashboard_default_refresh_interval():
    """Get default dashboard refresh interval"""
    return get_config('dashboard_default_refresh_interval', 300, 'integer')


def get_dashboard_max_widgets():
    """Get maximum widgets per dashboard"""
    return get_config('dashboard_max_widgets', 50, 'integer')


def get_dashboard_auto_refresh_enabled():
    """Check if dashboard auto refresh is enabled"""
    return get_config('dashboard_auto_refresh_enabled', True, 'boolean')


def get_report_max_execution_time():
    """Get maximum report execution time"""
    return get_config('report_max_execution_time', 3600, 'integer')


def get_report_retention_days():
    """Get report retention period"""
    return get_config('report_retention_days', 90, 'integer')


def get_report_max_file_size():
    """Get maximum report file size"""
    return get_config('report_max_file_size', 10485760, 'integer')


def get_kpi_default_measurement_interval():
    """Get default KPI measurement interval"""
    return get_config('kpi_default_measurement_interval', 24, 'integer')


def get_kpi_alert_threshold_percentage():
    """Get KPI alert threshold percentage"""
    return get_config('kpi_alert_threshold_percentage', 10.0, 'decimal')


def get_kpi_retention_days():
    """Get KPI measurement retention period"""
    return get_config('kpi_retention_days', 365, 'integer')


def get_alert_max_active_alerts():
    """Get maximum active alerts"""
    return get_config('alert_max_active_alerts', 100, 'integer')


def get_alert_escalation_hours():
    """Get alert escalation time"""
    return get_config('alert_escalation_hours', 24, 'integer')


def get_widget_type_choices():
    """Get widget type choices from configuration"""
    return [
        ('chart', 'Chart'),
        ('metric', 'Metric'),
        ('table', 'Table'),
        ('gauge', 'Gauge'),
        ('progress', 'Progress Bar'),
        ('list', 'List'),
    ]


def get_chart_type_choices():
    """Get chart type choices from configuration"""
    return [
        ('line', 'Line Chart'),
        ('bar', 'Bar Chart'),
        ('pie', 'Pie Chart'),
        ('doughnut', 'Doughnut Chart'),
        ('area', 'Area Chart'),
        ('scatter', 'Scatter Plot'),
    ]


def get_report_type_choices():
    """Get report type choices from configuration"""
    return [
        ('financial', 'Financial Report'),
        ('operational', 'Operational Report'),
        ('marketing', 'Marketing Report'),
        ('inventory', 'Inventory Report'),
        ('employee', 'Employee Report'),
        ('guest', 'Guest Report'),
        ('custom', 'Custom Report'),
    ]


def get_report_format_choices():
    """Get report format choices from configuration"""
    return [
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('json', 'JSON'),
    ]


def get_kpi_type_choices():
    """Get KPI type choices from configuration"""
    return [
        ('revenue', 'Revenue'),
        ('bookings', 'Bookings'),
        ('guests', 'Guests'),
        ('employees', 'Employees'),
        ('inventory', 'Inventory'),
        ('marketing', 'Marketing'),
        ('financial', 'Financial'),
    ]


def get_kpi_unit_choices():
    """Get KPI unit choices from configuration"""
    return [
        ('count', 'Count'),
        ('currency', 'Currency'),
        ('percentage', 'Percentage'),
        ('rate', 'Rate'),
        ('time', 'Time'),
    ]


def get_alert_type_choices():
    """Get alert type choices from configuration"""
    return [
        ('kpi', 'KPI Alert'),
        ('inventory', 'Inventory Alert'),
        ('financial', 'Financial Alert'),
        ('operational', 'Operational Alert'),
        ('system', 'System Alert'),
    ]


def get_severity_level_choices():
    """Get severity level choices from configuration"""
    return [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('critical', 'Critical'),
    ]


def get_widget_size_choices():
    """Get widget size choices from configuration"""
    return [
        ('small', 'Small'),
        ('medium', 'Medium'),
        ('large', 'Large'),
        ('full', 'Full Width'),
    ]


def get_color_scheme_choices():
    """Get color scheme choices from configuration"""
    return [
        ('default', 'Default'),
        ('green', 'Green'),
        ('red', 'Red'),
        ('blue', 'Blue'),
        ('yellow', 'Yellow'),
    ]
