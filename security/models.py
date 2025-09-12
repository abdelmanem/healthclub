from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import secrets

User = get_user_model()


class TwoFactorAuth(models.Model):
    """Two-factor authentication settings for users"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='two_factor_auth')
    is_enabled = models.BooleanField(default=False)
    secret_key = models.CharField(max_length=32, blank=True)
    backup_codes = models.JSONField(default=list, blank=True)
    
    # Recovery settings
    recovery_email = models.EmailField(blank=True)
    recovery_phone = models.CharField(max_length=20, blank=True)
    
    # Timestamps
    enabled_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self) -> str:
        return f"2FA for {self.user.username}"
    
    def generate_secret_key(self):
        """Generate a new secret key for TOTP"""
        try:
            import pyotp
            self.secret_key = pyotp.random_base32()
        except ImportError:
            # Fallback to a simple random string if pyotp is not available
            self.secret_key = secrets.token_hex(16)
        return self.secret_key
    
    def generate_backup_codes(self, count=10):
        """Generate backup codes for recovery"""
        codes = [secrets.token_hex(4).upper() for _ in range(count)]
        self.backup_codes = codes
        return codes
    
    def get_qr_code(self):
        """Generate QR code for authenticator app setup"""
        try:
            import pyotp
            import qrcode
            from io import BytesIO
            
            if not self.secret_key:
                self.generate_secret_key()
                self.save()
            
            totp = pyotp.TOTP(self.secret_key)
            provisioning_uri = totp.provisioning_uri(
                name=self.user.email or self.user.username,
                issuer_name="Health Club Management"
            )
            
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            return buffer.getvalue()
        except ImportError:
            # Return None if pyotp or qrcode is not available
            return None
    
    def verify_token(self, token):
        """Verify TOTP token"""
        if not self.is_enabled or not self.secret_key:
            return False
        
        try:
            import pyotp
            totp = pyotp.TOTP(self.secret_key)
            is_valid = totp.verify(token, valid_window=1)
        except ImportError:
            # Fallback verification if pyotp is not available
            is_valid = False
        
        if is_valid:
            self.last_used_at = timezone.now()
            self.save()
        
        return is_valid
    
    def verify_backup_code(self, code):
        """Verify backup code"""
        if code in self.backup_codes:
            self.backup_codes.remove(code)
            self.save()
            return True
        return False


class LoginAttempt(models.Model):
    """Track login attempts for security monitoring"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_attempts', null=True, blank=True)
    username = models.CharField(max_length=150)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    
    # Attempt details
    success = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=100, blank=True)
    two_factor_used = models.BooleanField(default=False)
    
    # Location data
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    attempted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-attempted_at']
    
    def __str__(self) -> str:
        return f"{self.username} - {'Success' if self.success else 'Failed'} - {self.attempted_at}"


class SecurityEvent(models.Model):
    """Security events and alerts"""
    EVENT_TYPES = (
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
    )
    
    SEVERITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='security_events', null=True, blank=True)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS, default='medium')
    
    # Event details
    description = models.TextField()
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    additional_data = models.JSONField(default=dict, blank=True)
    
    # Resolution
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_events')
    resolution_notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"{self.event_type} - {self.severity} - {self.created_at}"


class PasswordPolicy(models.Model):
    """Password policy configuration"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    # Password requirements
    min_length = models.PositiveIntegerField(default=8)
    require_uppercase = models.BooleanField(default=True)
    require_lowercase = models.BooleanField(default=True)
    require_numbers = models.BooleanField(default=True)
    require_special_chars = models.BooleanField(default=True)
    special_chars = models.CharField(max_length=50, default='!@#$%^&*()_+-=[]{}|;:,.<>?')
    
    # Password history
    prevent_reuse_count = models.PositiveIntegerField(default=5, help_text="Number of previous passwords to prevent reuse")
    
    # Expiration
    expires_days = models.PositiveIntegerField(null=True, blank=True, help_text="Password expiration in days (null for no expiration)")
    warning_days = models.PositiveIntegerField(default=7, help_text="Days before expiration to show warning")
    
    # Account lockout
    max_failed_attempts = models.PositiveIntegerField(default=5)
    lockout_duration_minutes = models.PositiveIntegerField(default=30)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class PasswordHistory(models.Model):
    """Password history for users"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_history')
    password_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'password_hash']
    
    def __str__(self) -> str:
        return f"{self.user.username} - {self.created_at}"


class SessionSecurity(models.Model):
    """Session security settings and monitoring"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_security')
    session_key = models.CharField(max_length=40, unique=True)
    
    # Session details
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    location = models.CharField(max_length=200, blank=True)
    
    # Security settings
    is_secure = models.BooleanField(default=False)
    is_http_only = models.BooleanField(default=True)
    same_site = models.CharField(max_length=20, default='Lax')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    
    # Status
    is_active = models.BooleanField(default=True)
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.CharField(max_length=100, blank=True)
    
    class Meta:
        ordering = ['-last_activity']
    
    def __str__(self) -> str:
        return f"{self.user.username} - {self.session_key[:8]}... - {self.ip_address}"
    
    def is_expired(self):
        """Check if session is expired"""
        return timezone.now() > self.expires_at
    
    def terminate(self, reason="Manual termination"):
        """Terminate the session"""
        self.is_active = False
        self.terminated_at = timezone.now()
        self.termination_reason = reason
        self.save()


class DataAccessLog(models.Model):
    """Log data access for audit purposes"""
    ACCESS_TYPES = (
        ('view', 'View'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('export', 'Export'),
        ('import', 'Import'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='data_access_logs')
    access_type = models.CharField(max_length=20, choices=ACCESS_TYPES)
    
    # Resource details
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)
    
    # Request details
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    
    # Changes
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    
    accessed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-accessed_at']
    
    def __str__(self) -> str:
        return f"{self.user.username} - {self.access_type} - {self.model_name} - {self.accessed_at}"


class SecurityConfiguration(models.Model):
    """System-wide security configuration"""
    name = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    data_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'String'),
            ('integer', 'Integer'),
            ('boolean', 'Boolean'),
            ('json', 'JSON'),
        ],
        default='string'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return f"{self.name}: {self.value}"
    
    @classmethod
    def get_value(cls, key, default=None, data_type='string'):
        """Get security configuration value with type conversion"""
        try:
            config = cls.objects.get(name=key, is_active=True)
            if data_type == 'integer':
                return int(config.value)
            elif data_type == 'boolean':
                return config.value.lower() in ('true', '1', 'yes')
            elif data_type == 'json':
                import json
                return json.loads(config.value)
            else:
                return config.value
        except cls.DoesNotExist:
            return default
