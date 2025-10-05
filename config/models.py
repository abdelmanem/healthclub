from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from simple_history.models import HistoricalRecords


class SystemConfiguration(models.Model):
    """Central configuration model for system-wide settings"""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    data_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'String'),
            ('integer', 'Integer'),
            ('decimal', 'Decimal'),
            ('boolean', 'Boolean'),
            ('json', 'JSON'),
        ],
        default='string'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['key']
        verbose_name = 'System Configuration'
        verbose_name_plural = 'System Configurations'
    
    def __str__(self) -> str:
        return f"{self.key}: {self.value}"
    
    @classmethod
    def get_value(cls, key, default=None, data_type='string'):
        """Get configuration value with type conversion"""
        try:
            config = cls.objects.get(key=key, is_active=True)
            if data_type == 'integer':
                return int(config.value)
            elif data_type == 'decimal':
                from decimal import Decimal
                return Decimal(config.value)
            elif data_type == 'boolean':
                return config.value.lower() in ('true', '1', 'yes')
            elif data_type == 'json':
                import json
                return json.loads(config.value)
            else:
                return config.value
        except cls.DoesNotExist:
            return default
    
    @classmethod
    def set_value(cls, key, value, description='', data_type='string'):
        """Set configuration value"""
        if data_type == 'json':
            import json
            value = json.dumps(value)
        else:
            value = str(value)
        
        config, created = cls.objects.get_or_create(
            key=key,
            defaults={
                'value': value,
                'description': description,
                'data_type': data_type
            }
        )
        if not created:
            config.value = value
            config.description = description
            config.data_type = data_type
            config.save()


class MembershipTier(models.Model):
    """Configurable membership tiers"""
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    discount_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    priority_booking = models.BooleanField(default=False)
    free_services_count = models.PositiveIntegerField(default=0)
    min_spend_required = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Minimum spend required to achieve this tier"
    )
    points_multiplier = models.DecimalField(
        max_digits=3, 
        decimal_places=2, 
        default=1.0,
        help_text="Points multiplier for this tier"
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['sort_order', 'name']
    
    def __str__(self) -> str:
        return self.display_name


class GenderOption(models.Model):
    """Configurable gender options"""
    code = models.CharField(max_length=32, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['sort_order', 'display_name']
    
    def __str__(self) -> str:
        return self.display_name


class CommissionType(models.Model):
    """Configurable commission types"""
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    default_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Default commission rate percentage"
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['sort_order', 'name']
    
    def __str__(self) -> str:
        return self.name


class TrainingType(models.Model):
    """Configurable training types"""
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    requires_certification = models.BooleanField(default=False)
    default_duration_days = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['sort_order', 'name']
    
    def __str__(self) -> str:
        return self.name


class ProductType(models.Model):
    """Configurable product types"""
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    requires_tracking = models.BooleanField(default=True, help_text="Whether stock tracking is required")
    default_tax_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['sort_order', 'name']
    
    def __str__(self) -> str:
        return self.name


class CancellationReason(models.Model):
    """Configurable cancellation reasons for reservations and other cancellable items"""
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Cancellation Reason'
        verbose_name_plural = 'Cancellation Reasons'
    
    def __str__(self) -> str:
        return self.name


class BusinessRule(models.Model):
    """Configurable business rules"""
    RULE_CATEGORIES = (
        ('booking', 'Booking Rules'),
        ('cancellation', 'Cancellation Rules'),
        ('payment', 'Payment Rules'),
        ('loyalty', 'Loyalty Program Rules'),
        ('inventory', 'Inventory Rules'),
        ('employee', 'Employee Rules'),
    )
    
    category = models.CharField(max_length=20, choices=RULE_CATEGORIES)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    data_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'String'),
            ('integer', 'Integer'),
            ('decimal', 'Decimal'),
            ('boolean', 'Boolean'),
            ('json', 'JSON'),
        ],
        default='string'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'name']
        unique_together = ['category', 'key']
    
    def __str__(self) -> str:
        return f"{self.category}: {self.name}"
    
    @classmethod
    def get_rule(cls, key, default=None, data_type='string'):
        """Get business rule value with type conversion"""
        try:
            rule = cls.objects.get(key=key, is_active=True)
            if data_type == 'integer':
                return int(rule.value)
            elif data_type == 'decimal':
                from decimal import Decimal
                return Decimal(rule.value)
            elif data_type == 'boolean':
                return rule.value.lower() in ('true', '1', 'yes')
            elif data_type == 'json':
                import json
                return json.loads(rule.value)
            else:
                return rule.value
        except cls.DoesNotExist:
            return default


class NotificationTemplate(models.Model):
    """Configurable notification templates"""
    TEMPLATE_TYPES = (
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('push', 'Push Notification'),
        ('in_app', 'In-App Notification'),
    )
    
    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    variables = models.JSONField(default=list, help_text="List of available variables")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['template_type', 'name']
        unique_together = ['name', 'template_type']
    
    def __str__(self) -> str:
        return f"{self.template_type}: {self.name}"
