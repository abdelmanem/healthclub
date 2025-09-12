from django.contrib import admin
from .models import (
    EmailCampaign, SMSCampaign, EmailTemplate, SMSTemplate,
    CommunicationLog, GuestSegment, MarketingAutomation
)


@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign_type', 'status', 'total_recipients', 'delivered_count', 'open_rate', 'created_at')
    list_filter = ('campaign_type', 'status', 'created_at')
    search_fields = ('name', 'subject', 'content')
    readonly_fields = ('total_recipients', 'delivered_count', 'opened_count', 'clicked_count', 'unsubscribed_count', 'bounced_count', 'sent_at')
    filter_horizontal = ('target_guests',)
    ordering = ['-created_at']


@admin.register(SMSCampaign)
class SMSCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign_type', 'status', 'total_recipients', 'delivered_count', 'created_at')
    list_filter = ('campaign_type', 'status', 'created_at')
    search_fields = ('name', 'message')
    readonly_fields = ('total_recipients', 'delivered_count', 'failed_count', 'sent_at')
    filter_horizontal = ('target_guests',)
    ordering = ['-created_at']


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'is_active', 'created_at')
    list_filter = ('template_type', 'is_active', 'created_at')
    search_fields = ('name', 'subject', 'content')
    ordering = ['template_type', 'name']


@admin.register(SMSTemplate)
class SMSTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'is_active', 'created_at')
    list_filter = ('template_type', 'is_active', 'created_at')
    search_fields = ('name', 'message')
    ordering = ['template_type', 'name']


@admin.register(CommunicationLog)
class CommunicationLogAdmin(admin.ModelAdmin):
    list_display = ('guest', 'communication_type', 'status', 'sent_at', 'created_at')
    list_filter = ('communication_type', 'status', 'sent_at', 'created_at')
    search_fields = ('guest__first_name', 'guest__last_name', 'subject', 'message')
    readonly_fields = ('sent_at', 'delivered_at', 'opened_at', 'clicked_at', 'response_data')
    ordering = ['-created_at']


@admin.register(GuestSegment)
class GuestSegmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    filter_horizontal = ('membership_tiers', 'preferred_services')
    ordering = ['name']


@admin.register(MarketingAutomation)
class MarketingAutomationAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_type', 'action_type', 'delay_minutes', 'is_active', 'created_at')
    list_filter = ('trigger_type', 'action_type', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    ordering = ['name']
