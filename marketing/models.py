from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from simple_history.models import HistoricalRecords
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailCampaign(models.Model):
    """Email marketing campaigns"""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('cancelled', 'Cancelled'),
    )
    
    CAMPAIGN_TYPES = (
        ('promotional', 'Promotional'),
        ('newsletter', 'Newsletter'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('loyalty_update', 'Loyalty Update'),
        ('birthday', 'Birthday'),
        ('anniversary', 'Anniversary'),
        ('re_engagement', 'Re-engagement'),
    )
    
    name = models.CharField(max_length=200)
    campaign_type = models.CharField(max_length=30, choices=CAMPAIGN_TYPES)
    subject = models.CharField(max_length=200)
    content = models.TextField()
    html_content = models.TextField(blank=True)
    
    # Targeting
    target_segment = models.CharField(max_length=100, blank=True, help_text="Target segment criteria")
    target_guests = models.ManyToManyField('guests.Guest', blank=True, related_name='email_campaigns')
    
    # Scheduling
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    # Tracking
    total_recipients = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    opened_count = models.PositiveIntegerField(default=0)
    clicked_count = models.PositiveIntegerField(default=0)
    unsubscribed_count = models.PositiveIntegerField(default=0)
    bounced_count = models.PositiveIntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_campaigns')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return self.name
    
    @property
    def open_rate(self):
        if self.delivered_count > 0:
            return (self.opened_count / self.delivered_count) * 100
        return 0
    
    @property
    def click_rate(self):
        if self.delivered_count > 0:
            return (self.clicked_count / self.delivered_count) * 100
        return 0


class SMSCampaign(models.Model):
    """SMS marketing campaigns"""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('cancelled', 'Cancelled'),
    )
    
    CAMPAIGN_TYPES = (
        ('promotional', 'Promotional'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('loyalty_update', 'Loyalty Update'),
        ('birthday', 'Birthday'),
        ('emergency', 'Emergency'),
        ('re_engagement', 'Re-engagement'),
    )
    
    name = models.CharField(max_length=200)
    campaign_type = models.CharField(max_length=30, choices=CAMPAIGN_TYPES)
    message = models.TextField(max_length=1600)  # SMS character limit
    
    # Targeting
    target_segment = models.CharField(max_length=100, blank=True)
    target_guests = models.ManyToManyField('guests.Guest', blank=True, related_name='sms_campaigns')
    
    # Scheduling
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    # Tracking
    total_recipients = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_sms_campaigns')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return self.name


class EmailTemplate(models.Model):
    """Reusable email templates"""
    TEMPLATE_TYPES = (
        ('welcome', 'Welcome Email'),
        ('appointment_confirmation', 'Appointment Confirmation'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('cancellation', 'Cancellation'),
        ('loyalty_points', 'Loyalty Points'),
        ('birthday', 'Birthday'),
        ('promotional', 'Promotional'),
        ('newsletter', 'Newsletter'),
    )
    
    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPES)
    subject = models.CharField(max_length=200)
    content = models.TextField()
    html_content = models.TextField(blank=True)
    variables = models.JSONField(default=list, help_text="Available template variables")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['template_type', 'name']
        unique_together = ['name', 'template_type']
    
    def __str__(self) -> str:
        return f"{self.template_type}: {self.name}"


class SMSTemplate(models.Model):
    """Reusable SMS templates"""
    TEMPLATE_TYPES = (
        ('appointment_confirmation', 'Appointment Confirmation'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('cancellation', 'Cancellation'),
        ('loyalty_points', 'Loyalty Points'),
        ('birthday', 'Birthday'),
        ('promotional', 'Promotional'),
        ('emergency', 'Emergency'),
    )
    
    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPES)
    message = models.TextField(max_length=1600)
    variables = models.JSONField(default=list, help_text="Available template variables")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['template_type', 'name']
        unique_together = ['name', 'template_type']
    
    def __str__(self) -> str:
        return f"{self.template_type}: {self.name}"


class CommunicationLog(models.Model):
    """Log of all communications sent to guests"""
    COMMUNICATION_TYPES = (
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('push', 'Push Notification'),
        ('in_app', 'In-App Notification'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
        ('unsubscribed', 'Unsubscribed'),
    )
    
    guest = models.ForeignKey('guests.Guest', on_delete=models.CASCADE, related_name='marketing_communications')
    communication_type = models.CharField(max_length=20, choices=COMMUNICATION_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Content
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    
    # Campaign reference
    email_campaign = models.ForeignKey(EmailCampaign, on_delete=models.SET_NULL, null=True, blank=True)
    sms_campaign = models.ForeignKey(SMSCampaign, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Tracking
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    # Response data
    external_id = models.CharField(max_length=200, blank=True, help_text="External service ID")
    response_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"{self.guest} - {self.communication_type} - {self.status}"


class GuestSegment(models.Model):
    """Guest segmentation for targeted marketing"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Segmentation criteria
    membership_tiers = models.ManyToManyField('config.MembershipTier', blank=True)
    min_visit_count = models.PositiveIntegerField(null=True, blank=True)
    max_visit_count = models.PositiveIntegerField(null=True, blank=True)
    min_total_spent = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_total_spent = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    last_visit_days_ago_min = models.PositiveIntegerField(null=True, blank=True)
    last_visit_days_ago_max = models.PositiveIntegerField(null=True, blank=True)
    preferred_services = models.ManyToManyField('services.Service', blank=True)
    
    # Communication preferences
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name
    
    def get_guests(self):
        """Get guests matching this segment criteria"""
        from guests.models import Guest
        from django.db.models import Q
        from datetime import datetime, timedelta
        
        queryset = Guest.objects.all()
        
        # Membership tiers
        if self.membership_tiers.exists():
            queryset = queryset.filter(membership_tier__in=self.membership_tiers.all())
        
        # Visit count
        if self.min_visit_count is not None:
            queryset = queryset.filter(visit_count__gte=self.min_visit_count)
        if self.max_visit_count is not None:
            queryset = queryset.filter(visit_count__lte=self.max_visit_count)
        
        # Total spent
        if self.min_total_spent is not None:
            queryset = queryset.filter(total_spent__gte=self.min_total_spent)
        if self.max_total_spent is not None:
            queryset = queryset.filter(total_spent__lte=self.max_total_spent)
        
        # Last visit
        if self.last_visit_days_ago_min is not None:
            min_date = datetime.now() - timedelta(days=self.last_visit_days_ago_min)
            queryset = queryset.filter(last_visit__gte=min_date)
        if self.last_visit_days_ago_max is not None:
            max_date = datetime.now() - timedelta(days=self.last_visit_days_ago_max)
            queryset = queryset.filter(last_visit__lte=max_date)
        
        # Preferred services
        if self.preferred_services.exists():
            queryset = queryset.filter(preferred_services__in=self.preferred_services.all())
        
        return queryset.distinct()


class MarketingAutomation(models.Model):
    """Marketing automation rules"""
    TRIGGER_TYPES = (
        ('guest_signup', 'Guest Signup'),
        ('appointment_booked', 'Appointment Booked'),
        ('appointment_completed', 'Appointment Completed'),
        ('appointment_cancelled', 'Appointment Cancelled'),
        ('loyalty_tier_changed', 'Loyalty Tier Changed'),
        ('birthday', 'Birthday'),
        ('anniversary', 'Anniversary'),
        ('no_visit_days', 'No Visit for X Days'),
        ('low_loyalty_points', 'Low Loyalty Points'),
    )
    
    ACTION_TYPES = (
        ('send_email', 'Send Email'),
        ('send_sms', 'Send SMS'),
        ('add_to_segment', 'Add to Segment'),
        ('remove_from_segment', 'Remove from Segment'),
        ('award_points', 'Award Points'),
    )
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Trigger
    trigger_type = models.CharField(max_length=30, choices=TRIGGER_TYPES)
    trigger_conditions = models.JSONField(default=dict, blank=True)
    
    # Action
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    action_config = models.JSONField(default=dict, blank=True)
    
    # Timing
    delay_minutes = models.PositiveIntegerField(default=0, help_text="Delay before action in minutes")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name
