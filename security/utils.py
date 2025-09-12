"""
Security utility functions for accessing configurations
"""
from config.utils import get_config


def get_two_factor_enabled():
    """Check if two-factor authentication is enabled"""
    return get_config('two_factor_enabled', True, 'boolean')


def get_two_factor_backup_codes_count():
    """Get number of backup codes to generate"""
    return get_config('two_factor_backup_codes_count', 10, 'integer')


def get_two_factor_grace_period_hours():
    """Get 2FA grace period for new users"""
    return get_config('two_factor_grace_period_hours', 24, 'integer')


def get_password_min_length():
    """Get minimum password length"""
    return get_config('password_min_length', 8, 'integer')


def get_password_require_uppercase():
    """Check if uppercase letters are required in password"""
    return get_config('password_require_uppercase', True, 'boolean')


def get_password_require_lowercase():
    """Check if lowercase letters are required in password"""
    return get_config('password_require_lowercase', True, 'boolean')


def get_password_require_numbers():
    """Check if numbers are required in password"""
    return get_config('password_require_numbers', True, 'boolean')


def get_password_require_special_chars():
    """Check if special characters are required in password"""
    return get_config('password_require_special_chars', True, 'boolean')


def get_password_expires_days():
    """Get password expiration in days"""
    return get_config('password_expires_days', 90, 'integer')


def get_password_prevent_reuse_count():
    """Get number of previous passwords to prevent reuse"""
    return get_config('password_prevent_reuse_count', 5, 'integer')


def get_max_failed_login_attempts():
    """Get maximum failed login attempts before lockout"""
    return get_config('max_failed_login_attempts', 5, 'integer')


def get_account_lockout_duration_minutes():
    """Get account lockout duration in minutes"""
    return get_config('account_lockout_duration_minutes', 30, 'integer')


def get_login_attempt_window_minutes():
    """Get login attempt tracking window in minutes"""
    return get_config('login_attempt_window_minutes', 15, 'integer')


def get_session_timeout_minutes():
    """Get session timeout in minutes"""
    return get_config('session_timeout_minutes', 480, 'integer')


def get_session_secure_only():
    """Check if secure sessions are required"""
    return get_config('session_secure_only', True, 'boolean')


def get_session_http_only():
    """Check if session cookies should be HTTP only"""
    return get_config('session_http_only', True, 'boolean')


def get_session_same_site():
    """Get session cookie SameSite policy"""
    return get_config('session_same_site', 'Lax')


def get_audit_log_retention_days():
    """Get audit log retention period in days"""
    return get_config('audit_log_retention_days', 365, 'integer')


def get_audit_log_sensitive_fields():
    """Get sensitive fields to exclude from audit logs"""
    fields = get_config('audit_log_sensitive_fields', 'password,secret_key,token')
    return [field.strip() for field in fields.split(',')]


def get_security_alert_email():
    """Get email for security alerts"""
    return get_config('security_alert_email', 'security@healthclub.com')


def get_suspicious_activity_threshold():
    """Get number of failed attempts to trigger suspicious activity alert"""
    return get_config('suspicious_activity_threshold', 10, 'integer')


def get_event_type_choices():
    """Get security event type choices from configuration"""
    return [
        ('login_success', 'Login Success'),
        ('login_failure', 'Login Failure'),
        ('password_change', 'Password Change'),
        ('two_factor_enabled', '2FA Enabled'),
        ('two_factor_disabled', '2FA Disabled'),
        ('suspicious_activity', 'Suspicious Activity'),
        ('account_locked', 'Account Locked'),
        ('account_unlocked', 'Account Unlocked'),
        ('permission_change', 'Permission Change'),
        ('data_export', 'Data Export'),
        ('admin_action', 'Admin Action'),
    ]


def get_severity_level_choices():
    """Get severity level choices from configuration"""
    return [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]


def get_access_type_choices():
    """Get data access type choices from configuration"""
    return [
        ('view', 'View'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('export', 'Export'),
        ('import', 'Import'),
    ]


def get_data_type_choices():
    """Get configuration data type choices"""
    return [
        ('string', 'String'),
        ('integer', 'Integer'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
    ]
