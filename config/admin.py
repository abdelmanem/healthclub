from django.contrib import admin
from .models import (
    SystemConfiguration, MembershipTier, GenderOption, CommissionType,
    TrainingType, ProductType, BusinessRule, NotificationTemplate
)


@admin.register(SystemConfiguration)
class SystemConfigurationAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'data_type', 'is_active', 'updated_at')
    list_filter = ('data_type', 'is_active', 'created_at')
    search_fields = ('key', 'description')
    ordering = ['key']


@admin.register(MembershipTier)
class MembershipTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_name', 'discount_percentage', 'priority_booking', 'free_services_count', 'is_active')
    list_filter = ('is_active', 'priority_booking')
    search_fields = ('name', 'display_name', 'description')
    ordering = ['sort_order', 'name']


@admin.register(GenderOption)
class GenderOptionAdmin(admin.ModelAdmin):
    list_display = ('code', 'display_name', 'is_active', 'sort_order')
    list_filter = ('is_active',)
    search_fields = ('code', 'display_name', 'description')
    ordering = ['sort_order', 'display_name']


@admin.register(CommissionType)
class CommissionTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'default_rate', 'is_active', 'sort_order')
    list_filter = ('is_active',)
    search_fields = ('code', 'name', 'description')
    ordering = ['sort_order', 'name']


@admin.register(TrainingType)
class TrainingTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'requires_certification', 'default_duration_days', 'is_active', 'sort_order')
    list_filter = ('is_active', 'requires_certification')
    search_fields = ('code', 'name', 'description')
    ordering = ['sort_order', 'name']


@admin.register(ProductType)
class ProductTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'requires_tracking', 'default_tax_rate', 'is_active', 'sort_order')
    list_filter = ('is_active', 'requires_tracking')
    search_fields = ('code', 'name', 'description')
    ordering = ['sort_order', 'name']


@admin.register(BusinessRule)
class BusinessRuleAdmin(admin.ModelAdmin):
    list_display = ('category', 'name', 'key', 'value', 'data_type', 'is_active', 'updated_at')
    list_filter = ('category', 'data_type', 'is_active', 'created_at')
    search_fields = ('name', 'key', 'description')
    ordering = ['category', 'name']


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'subject', 'is_active', 'updated_at')
    list_filter = ('template_type', 'is_active', 'created_at')
    search_fields = ('name', 'subject', 'body')
    ordering = ['template_type', 'name']
