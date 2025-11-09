"""
Utility functions for accessing system configurations
"""
from .models import SystemConfiguration, BusinessRule, MembershipTier, GenderOption


def get_config(key, default=None, data_type='string'):
    """Get system configuration value"""
    return SystemConfiguration.get_value(key, default, data_type)


def get_business_rule(key, default=None, data_type='string'):
    """Get business rule value"""
    return BusinessRule.get_rule(key, default, data_type)


def get_membership_tiers():
    """Get all active membership tiers"""
    return MembershipTier.objects.filter(is_active=True).order_by('sort_order')


def get_gender_options():
    """Get all active gender options"""
    return GenderOption.objects.filter(is_active=True).order_by('sort_order')


def get_company_info():
    """Get company information from configuration"""
    return {
        'name': get_config('company_name', 'Health Club Management System'),
        'email': get_config('company_email', 'info@healthclub.com'),
        'phone': get_config('company_phone', '+1-555-0123'),
        'currency': get_config('default_currency', 'USD'),
        'timezone': get_config('timezone', 'America/New_York'),
    }


def get_booking_rules():
    """Get booking-related business rules"""
    return {
        'min_advance_hours': get_business_rule('min_advance_booking_hours', 24, 'integer'),
        'max_advance_days': get_business_rule('max_advance_booking_days', 30, 'integer'),
        'cancellation_deadline_hours': get_business_rule('cancellation_deadline_hours', 24, 'integer'),
        'cancellation_fee_percentage': get_business_rule('cancellation_fee_percentage', 10.0, 'decimal'),
        'no_show_fee_percentage': get_business_rule('no_show_fee_percentage', 50.0, 'decimal'),
    }


def get_loyalty_settings():
    """Get loyalty program settings"""
    return {
        'enabled': get_config('enable_loyalty_program', True, 'boolean'),
        'points_per_dollar': get_config('loyalty_points_per_dollar', 1, 'decimal'),
        'points_expiry_days': get_business_rule('points_expiry_days', 365, 'integer'),
    }


def get_notification_settings():
    """Get notification settings"""
    return {
        'email_enabled': get_config('enable_email_notifications', True, 'boolean'),
        'sms_enabled': get_config('enable_sms_notifications', True, 'boolean'),
    }


def get_membership_benefits(tier_name):
    """Get benefits for a specific membership tier"""
    try:
        tier = MembershipTier.objects.get(name=tier_name, is_active=True)
        return {
            'discount': float(tier.discount_percentage),
            'priority_booking': tier.priority_booking,
            'free_services': tier.free_services_count,
            'points_multiplier': float(tier.points_multiplier),
            'min_spend_required': float(tier.min_spend_required),
        }
    except MembershipTier.DoesNotExist:
        # Return default bronze tier benefits
        return {
            'discount': 0,
            'priority_booking': False,
            'free_services': 0,
            'points_multiplier': 1.0,
            'min_spend_required': 0,
        }


def get_gender_choices():
    """Get gender choices for forms"""
    return [(option.code, option.display_name) for option in get_gender_options()]


def get_membership_tier_choices():
    """Get membership tier choices for forms"""
    return [(tier.name, tier.display_name) for tier in get_membership_tiers()]


def format_currency(amount):
    """
    Format currency amount using system configuration
    
    Args:
        amount: Decimal, float, or string amount to format
        
    Returns:
        str: Formatted currency string with symbol
    """
    from decimal import Decimal
    
    # Get currency configuration - check multiple keys like frontend does
    currency_code = (
        get_config('system_currency_code') or
        get_config('system_currency') or
        get_config('default_currency') or
        get_config('currency_code') or
        get_config('currency') or
        None
    )
    
    currency_symbol = (
        get_config('system_currency_symbol') or
        get_config('currency_symbol') or
        get_config('currency.sign') or
        None
    )
    
    # Convert amount to float
    try:
        if isinstance(amount, Decimal):
            amount_float = float(amount)
        elif isinstance(amount, str):
            amount_float = float(amount)
        else:
            amount_float = float(amount)
    except (ValueError, TypeError):
        amount_float = 0.0
    
    # If currency_code is set but not a valid ISO code (like "LE"), use it as symbol
    # Valid ISO currency codes are 3 letters (USD, EUR, EGP, LBP, etc.)
    # If it's 2 letters or not standard, treat it as a symbol
    final_symbol = currency_symbol
    if currency_code:
        # Check if it looks like a valid ISO currency code (3 uppercase letters)
        if len(currency_code) == 3 and currency_code.isupper() and currency_code.isalpha():
            # It's a valid ISO code, but we still need a symbol for display
            # Try to get symbol from config, or use the code as fallback
            if not final_symbol:
                # For common currencies, map code to symbol
                currency_map = {
                    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
                    'EGP': 'E£', 'LBP': 'L£', 'SAR': '﷼', 'AED': 'د.إ',
                }
                final_symbol = currency_map.get(currency_code, currency_code)
        else:
            # Not a valid ISO code, treat it as a symbol (e.g., "LE", "L.E.")
            final_symbol = currency_code
    
    # Final fallback
    if not final_symbol:
        final_symbol = '$'
    
    return f"{final_symbol}{amount_float:.2f}"