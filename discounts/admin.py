from django.contrib import admin
from .models import DiscountType, ReservationDiscount, DiscountRule


@admin.register(DiscountType)
class DiscountTypeAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'code', 'discount_method', 'discount_value', 
        'is_active', 'requires_approval', 'created_at'
    ]
    list_filter = [
        'discount_method', 'is_active', 'requires_approval', 
        'created_at', 'valid_from', 'valid_until'
    ]
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'code', 'description')
        }),
        ('Discount Configuration', {
            'fields': (
                'discount_method', 'discount_value', 'max_discount_amount',
                'min_order_amount'
            )
        }),
        ('Access Control', {
            'fields': ('is_active', 'requires_approval')
        }),
        ('Applicability', {
            'fields': (
                'applicable_services', 'applicable_membership_tiers'
            )
        }),
        ('Usage Limits', {
            'fields': (
                'usage_limit_per_guest', 'usage_limit_per_day'
            )
        }),
        ('Validity Period', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ReservationDiscount)
class ReservationDiscountAdmin(admin.ModelAdmin):
    list_display = [
        'reservation', 'discount_type', 'discount_amount', 
        'status', 'applied_by', 'applied_at'
    ]
    list_filter = [
        'status', 'discount_type', 'applied_at', 
        'applied_by', 'approved_by'
    ]
    search_fields = [
        'reservation__guest__first_name', 
        'reservation__guest__last_name',
        'discount_type__name',
        'reason'
    ]
    readonly_fields = [
        'applied_at', 'approved_at', 'rejected_at',
        'original_amount', 'final_amount'
    ]
    
    fieldsets = (
        ('Reservation & Discount', {
            'fields': ('reservation', 'discount_type')
        }),
        ('Financial Information', {
            'fields': (
                'original_amount', 'discount_amount', 'final_amount'
            )
        }),
        ('Status & Workflow', {
            'fields': (
                'status', 'applied_by', 'approved_by',
                'applied_at', 'approved_at', 'rejected_at'
            )
        }),
        ('Additional Information', {
            'fields': ('reason', 'notes', 'rejection_reason')
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'reservation', 'discount_type', 'applied_by', 'approved_by'
        )


@admin.register(DiscountRule)
class DiscountRuleAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'discount_type', 'priority', 'is_active', 'created_at'
    ]
    list_filter = ['is_active', 'priority', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description')
        }),
        ('Rule Configuration', {
            'fields': ('is_active', 'priority', 'conditions')
        }),
        ('Actions', {
            'fields': ('discount_type',)
        }),
        ('Validity Period', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
