"""
Marketing utility functions for accessing configurations
"""
from config.utils import get_config


def get_email_campaign_default_status():
    """Get default status for email campaigns"""
    return get_config('email_campaign_default_status', 'draft')


def get_sms_campaign_default_status():
    """Get default status for SMS campaigns"""
    return get_config('sms_campaign_default_status', 'draft')


def get_email_campaign_max_recipients():
    """Get maximum recipients for email campaigns"""
    return get_config('email_campaign_max_recipients', 10000, 'integer')


def get_sms_campaign_max_recipients():
    """Get maximum recipients for SMS campaigns"""
    return get_config('sms_campaign_max_recipients', 1000, 'integer')


def get_sms_character_limit():
    """Get SMS character limit"""
    return get_config('sms_character_limit', 1600, 'integer')


def get_marketing_automation_enabled():
    """Check if marketing automation is enabled"""
    return get_config('marketing_automation_enabled', True, 'boolean')


def get_automation_max_delay_hours():
    """Get maximum delay for automation actions"""
    return get_config('automation_max_delay_hours', 168, 'integer')


def get_default_segment_min_visits():
    """Get default minimum visits for guest segmentation"""
    return get_config('default_segment_min_visits', 1, 'integer')


def get_default_segment_min_spend():
    """Get default minimum spend for guest segmentation"""
    return get_config('default_segment_min_spend', 100.0, 'decimal')


def get_campaign_status_choices():
    """Get campaign status choices from configuration"""
    # This would be dynamic based on configuration
    return [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('cancelled', 'Cancelled'),
    ]


def get_campaign_type_choices():
    """Get campaign type choices from configuration"""
    # This would be dynamic based on configuration
    return [
        ('promotional', 'Promotional'),
        ('newsletter', 'Newsletter'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('loyalty_update', 'Loyalty Update'),
        ('birthday', 'Birthday'),
        ('anniversary', 'Anniversary'),
        ('re_engagement', 'Re-engagement'),
    ]


def get_template_type_choices():
    """Get template type choices from configuration"""
    return [
        ('welcome', 'Welcome Email'),
        ('appointment_confirmation', 'Appointment Confirmation'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('cancellation', 'Cancellation'),
        ('loyalty_points', 'Loyalty Points'),
        ('birthday', 'Birthday'),
        ('promotional', 'Promotional'),
        ('newsletter', 'Newsletter'),
    ]


def get_sms_template_type_choices():
    """Get SMS template type choices from configuration"""
    return [
        ('appointment_confirmation', 'Appointment Confirmation'),
        ('appointment_reminder', 'Appointment Reminder'),
        ('cancellation', 'Cancellation'),
        ('loyalty_points', 'Loyalty Points'),
        ('birthday', 'Birthday'),
        ('promotional', 'Promotional'),
        ('emergency', 'Emergency'),
    ]


def get_trigger_type_choices():
    """Get automation trigger type choices from configuration"""
    return [
        ('guest_signup', 'Guest Signup'),
        ('appointment_booked', 'Appointment Booked'),
        ('appointment_completed', 'Appointment Completed'),
        ('appointment_cancelled', 'Appointment Cancelled'),
        ('loyalty_tier_changed', 'Loyalty Tier Changed'),
        ('birthday', 'Birthday'),
        ('anniversary', 'Anniversary'),
        ('no_visit_days', 'No Visit for X Days'),
        ('low_loyalty_points', 'Low Loyalty Points'),
    ]


def get_action_type_choices():
    """Get automation action type choices from configuration"""
    return [
        ('send_email', 'Send Email'),
        ('send_sms', 'Send SMS'),
        ('add_to_segment', 'Add to Segment'),
        ('remove_from_segment', 'Remove from Segment'),
        ('award_points', 'Award Points'),
    ]
