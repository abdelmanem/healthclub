from django.contrib import admin
from .models import (
    TwoFactorAuth, LoginAttempt, SecurityEvent, PasswordPolicy,
    PasswordHistory, SessionSecurity, DataAccessLog, SecurityConfiguration
)


@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_enabled', 'enabled_at', 'last_used_at', 'created_at')
    list_filter = ('is_enabled', 'enabled_at', 'created_at')
    search_fields = ('user__username', 'user__email', 'recovery_email')
    readonly_fields = ('secret_key', 'backup_codes', 'enabled_at', 'last_used_at', 'created_at', 'updated_at')
    ordering = ['-created_at']


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ('username', 'ip_address', 'success', 'failure_reason', 'country', 'attempted_at')
    list_filter = ('success', 'two_factor_used', 'country', 'attempted_at')
    search_fields = ('username', 'ip_address', 'country', 'city')
    readonly_fields = ('attempted_at',)
    ordering = ['-attempted_at']


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'severity', 'user', 'ip_address', 'is_resolved', 'created_at')
    list_filter = ('event_type', 'severity', 'is_resolved', 'created_at')
    search_fields = ('user__username', 'description', 'ip_address')
    readonly_fields = ('created_at',)
    ordering = ['-created_at']


@admin.register(PasswordPolicy)
class PasswordPolicyAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_length', 'expires_days', 'max_failed_attempts', 'is_active', 'created_at')
    list_filter = ('is_active', 'require_uppercase', 'require_lowercase', 'require_numbers', 'require_special_chars')
    search_fields = ('name', 'description')
    ordering = ['name']


@admin.register(PasswordHistory)
class PasswordHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username',)
    readonly_fields = ('created_at',)
    ordering = ['-created_at']


@admin.register(SessionSecurity)
class SessionSecurityAdmin(admin.ModelAdmin):
    list_display = ('user', 'session_key', 'ip_address', 'is_active', 'last_activity', 'expires_at')
    list_filter = ('is_active', 'is_secure', 'created_at', 'last_activity')
    search_fields = ('user__username', 'ip_address', 'location')
    readonly_fields = ('created_at', 'last_activity', 'expires_at', 'terminated_at')
    ordering = ['-last_activity']


@admin.register(DataAccessLog)
class DataAccessLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'access_type', 'model_name', 'object_id', 'ip_address', 'accessed_at')
    list_filter = ('access_type', 'model_name', 'accessed_at')
    search_fields = ('user__username', 'model_name', 'object_repr', 'ip_address')
    readonly_fields = ('accessed_at',)
    ordering = ['-accessed_at']


@admin.register(SecurityConfiguration)
class SecurityConfigurationAdmin(admin.ModelAdmin):
    list_display = ('name', 'value', 'data_type', 'is_active', 'updated_at')
    list_filter = ('data_type', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    ordering = ['name']
