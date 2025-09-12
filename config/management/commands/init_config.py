from django.core.management.base import BaseCommand
from config.models import (
    SystemConfiguration, MembershipTier, GenderOption, CommissionType,
    TrainingType, ProductType, BusinessRule, NotificationTemplate
)


class Command(BaseCommand):
    help = 'Initialize default system configurations'

    def handle(self, *args, **options):
        self.stdout.write('Initializing system configurations...')
        
        # Initialize system configurations
        self.init_system_configs()
        
        # Initialize membership tiers
        self.init_membership_tiers()
        
        # Initialize gender options
        self.init_gender_options()
        
        # Initialize commission types
        self.init_commission_types()
        
        # Initialize training types
        self.init_training_types()
        
        # Initialize product types
        self.init_product_types()
        
        # Initialize business rules
        self.init_business_rules()
        
        # Initialize notification templates
        self.init_notification_templates()
        
        # Initialize marketing configurations
        self.init_marketing_configs()
        
        # Initialize analytics configurations
        self.init_analytics_configs()
        
        # Initialize security configurations
        self.init_security_configs()
        
        self.stdout.write(
            self.style.SUCCESS('Successfully initialized all configurations!')
        )

    def init_system_configs(self):
        """Initialize system-wide configurations"""
        configs = [
            ('company_name', 'Health Club Management System', 'Company name', 'string'),
            ('company_email', 'info@healthclub.com', 'Company email address', 'string'),
            ('company_phone', '+1-555-0123', 'Company phone number', 'string'),
            ('default_currency', 'USD', 'Default currency code', 'string'),
            ('timezone', 'America/New_York', 'Default timezone', 'string'),
            ('date_format', '%Y-%m-%d', 'Default date format', 'string'),
            ('time_format', '%H:%M', 'Default time format', 'string'),
            ('max_booking_advance_days', '90', 'Maximum days in advance for booking', 'integer'),
            ('min_booking_advance_hours', '24', 'Minimum hours in advance for booking', 'integer'),
            ('default_session_timeout', '3600', 'Default session timeout in seconds', 'integer'),
            ('enable_loyalty_program', 'true', 'Enable loyalty program', 'boolean'),
            ('loyalty_points_per_dollar', '1', 'Loyalty points per dollar spent', 'decimal'),
            ('enable_sms_notifications', 'true', 'Enable SMS notifications', 'boolean'),
            ('enable_email_notifications', 'true', 'Enable email notifications', 'boolean'),
        ]
        
        for key, value, description, data_type in configs:
            SystemConfiguration.set_value(key, value, description, data_type)
        
        self.stdout.write('✓ System configurations initialized')

    def init_membership_tiers(self):
        """Initialize membership tiers"""
        tiers = [
            ('bronze', 'Bronze', 'Basic membership tier', 0, False, 0, 0, 1.0),
            ('silver', 'Silver', 'Mid-tier membership with some benefits', 5, False, 1, 100, 1.2),
            ('gold', 'Gold', 'Premium membership with priority booking', 10, True, 2, 500, 1.5),
            ('platinum', 'Platinum', 'VIP membership with exclusive benefits', 15, True, 3, 1000, 2.0),
            ('vip', 'VIP', 'Ultimate membership tier', 20, True, 5, 2000, 2.5),
        ]
        
        for code, name, desc, discount, priority, free_services, min_spend, multiplier in tiers:
            MembershipTier.objects.get_or_create(
                name=code,
                defaults={
                    'display_name': name,
                    'description': desc,
                    'discount_percentage': discount,
                    'priority_booking': priority,
                    'free_services_count': free_services,
                    'min_spend_required': min_spend,
                    'points_multiplier': multiplier,
                    'sort_order': len(tiers) - tiers.index((code, name, desc, discount, priority, free_services, min_spend, multiplier))
                }
            )
        
        self.stdout.write('✓ Membership tiers initialized')

    def init_gender_options(self):
        """Initialize gender options"""
        genders = [
            ('male', 'Male', 'Male gender option'),
            ('female', 'Female', 'Female gender option'),
            ('other', 'Other', 'Other gender option'),
            ('prefer_not_to_say', 'Prefer not to say', 'Prefer not to disclose gender'),
        ]
        
        for code, name, desc in genders:
            GenderOption.objects.get_or_create(
                code=code,
                defaults={
                    'display_name': name,
                    'description': desc,
                    'sort_order': len(genders) - genders.index((code, name, desc))
                }
            )
        
        self.stdout.write('✓ Gender options initialized')

    def init_commission_types(self):
        """Initialize commission types"""
        types = [
            ('service', 'Service Commission', 'Commission for providing services', 10.0),
            ('sales', 'Sales Commission', 'Commission for sales activities', 5.0),
            ('bonus', 'Performance Bonus', 'Performance-based bonus', 0.0),
            ('overtime', 'Overtime Pay', 'Additional pay for overtime work', 0.0),
        ]
        
        for code, name, desc, rate in types:
            CommissionType.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': desc,
                    'default_rate': rate,
                    'sort_order': len(types) - types.index((code, name, desc, rate))
                }
            )
        
        self.stdout.write('✓ Commission types initialized')

    def init_training_types(self):
        """Initialize training types"""
        types = [
            ('certification', 'Certification', 'Professional certification training', True, 7),
            ('workshop', 'Workshop', 'Hands-on workshop training', False, 1),
            ('seminar', 'Seminar', 'Educational seminar', False, 1),
            ('online', 'Online Course', 'Online learning course', False, 3),
            ('on_job', 'On-the-Job Training', 'Practical on-site training', False, 5),
        ]
        
        for code, name, desc, requires_cert, duration in types:
            TrainingType.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': desc,
                    'requires_certification': requires_cert,
                    'default_duration_days': duration,
                    'sort_order': len(types) - types.index((code, name, desc, requires_cert, duration))
                }
            )
        
        self.stdout.write('✓ Training types initialized')

    def init_product_types(self):
        """Initialize product types"""
        types = [
            ('retail', 'Retail Product', 'Products sold to customers', True, 8.5),
            ('supply', 'Supply Item', 'Internal supply items', True, 0.0),
            ('equipment', 'Equipment', 'Equipment and tools', True, 0.0),
            ('consumable', 'Consumable', 'Consumable items', True, 0.0),
        ]
        
        for code, name, desc, tracking, tax in types:
            ProductType.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': desc,
                    'requires_tracking': tracking,
                    'default_tax_rate': tax,
                    'sort_order': len(types) - types.index((code, name, desc, tracking, tax))
                }
            )
        
        self.stdout.write('✓ Product types initialized')

    def init_business_rules(self):
        """Initialize business rules"""
        rules = [
            ('booking', 'Min Advance Booking Hours', 'min_advance_booking_hours', '24', 'integer'),
            ('booking', 'Max Advance Booking Days', 'max_advance_booking_days', '30', 'integer'),
            ('cancellation', 'Cancellation Deadline Hours', 'cancellation_deadline_hours', '24', 'integer'),
            ('cancellation', 'Cancellation Fee Percentage', 'cancellation_fee_percentage', '10.0', 'decimal'),
            ('cancellation', 'No Show Fee Percentage', 'no_show_fee_percentage', '50.0', 'decimal'),
            ('payment', 'Default Payment Terms', 'default_payment_terms', 'Due on receipt', 'string'),
            ('payment', 'Late Fee Amount', 'late_fee_amount', '25.00', 'decimal'),
            ('loyalty', 'Points Per Dollar', 'points_per_dollar', '1', 'integer'),
            ('loyalty', 'Points Expiry Days', 'points_expiry_days', '365', 'integer'),
            ('inventory', 'Low Stock Alert Threshold', 'low_stock_threshold', '10', 'integer'),
            ('inventory', 'Auto Reorder Enabled', 'auto_reorder_enabled', 'false', 'boolean'),
            ('employee', 'Default Commission Rate', 'default_commission_rate', '10.0', 'decimal'),
            ('employee', 'Performance Review Frequency Days', 'review_frequency_days', '90', 'integer'),
        ]
        
        for category, name, key, value, data_type in rules:
            BusinessRule.objects.get_or_create(
                key=key,
                defaults={
                    'category': category,
                    'name': name,
                    'value': value,
                    'data_type': data_type
                }
            )
        
        self.stdout.write('✓ Business rules initialized')

    def init_notification_templates(self):
        """Initialize notification templates"""
        templates = [
            ('email', 'Appointment Confirmation', 'Appointment Confirmed - {{service_name}}', 
             'Dear {{guest_name}},\n\nYour appointment for {{service_name}} has been confirmed for {{appointment_date}} at {{appointment_time}}.\n\nLocation: {{location_name}}\nTherapist: {{therapist_name}}\n\nPlease arrive 15 minutes early.\n\nThank you!', 
             ['guest_name', 'service_name', 'appointment_date', 'appointment_time', 'location_name', 'therapist_name']),
            
            ('email', 'Appointment Reminder', 'Reminder: Your appointment tomorrow', 
             'Dear {{guest_name}},\n\nThis is a reminder that you have an appointment tomorrow:\n\nService: {{service_name}}\nTime: {{appointment_time}}\nLocation: {{location_name}}\n\nTherapist: {{therapist_name}}\n\nWe look forward to seeing you!\n\nThank you!', 
             ['guest_name', 'service_name', 'appointment_time', 'location_name', 'therapist_name']),
            
            ('sms', 'Appointment Confirmation', '', 
             'Hi {{guest_name}}, your {{service_name}} appointment is confirmed for {{appointment_date}} at {{appointment_time}}. Location: {{location_name}}', 
             ['guest_name', 'service_name', 'appointment_date', 'appointment_time', 'location_name']),
            
            ('email', 'Loyalty Points Earned', 'You earned loyalty points!', 
             'Dear {{guest_name}},\n\nYou have earned {{points_earned}} loyalty points from your recent visit!\n\nTotal points: {{total_points}}\n\nThank you for your continued patronage!', 
             ['guest_name', 'points_earned', 'total_points']),
        ]
        
        for template_type, name, subject, body, variables in templates:
            NotificationTemplate.objects.get_or_create(
                name=name,
                template_type=template_type,
                defaults={
                    'subject': subject,
                    'body': body,
                    'variables': variables
                }
            )
        
        self.stdout.write('✓ Notification templates initialized')

    def init_marketing_configs(self):
        """Initialize marketing configurations"""
        configs = [
            # Email Campaign Settings
            ('email_campaign_default_status', 'draft', 'Default status for new email campaigns', 'string'),
            ('email_campaign_max_recipients', '10000', 'Maximum recipients per email campaign', 'integer'),
            ('email_campaign_rate_limit', '100', 'Email sending rate limit per minute', 'integer'),
            
            # SMS Campaign Settings
            ('sms_campaign_default_status', 'draft', 'Default status for new SMS campaigns', 'string'),
            ('sms_campaign_max_recipients', '1000', 'Maximum recipients per SMS campaign', 'integer'),
            ('sms_campaign_rate_limit', '50', 'SMS sending rate limit per minute', 'integer'),
            ('sms_character_limit', '1600', 'Maximum characters per SMS message', 'integer'),
            
            # Marketing Automation
            ('marketing_automation_enabled', 'true', 'Enable marketing automation', 'boolean'),
            ('automation_max_delay_hours', '168', 'Maximum delay for automation actions in hours', 'integer'),
            
            # Guest Segmentation
            ('default_segment_min_visits', '1', 'Default minimum visits for guest segmentation', 'integer'),
            ('default_segment_min_spend', '100.00', 'Default minimum spend for guest segmentation', 'decimal'),
        ]
        
        for key, value, description, data_type in configs:
            SystemConfiguration.set_value(key, value, description, data_type)
        
        self.stdout.write('✓ Marketing configurations initialized')

    def init_analytics_configs(self):
        """Initialize analytics configurations"""
        configs = [
            # Dashboard Settings
            ('dashboard_default_refresh_interval', '300', 'Default dashboard refresh interval in seconds', 'integer'),
            ('dashboard_max_widgets', '50', 'Maximum widgets per dashboard', 'integer'),
            ('dashboard_auto_refresh_enabled', 'true', 'Enable automatic dashboard refresh', 'boolean'),
            
            # Report Settings
            ('report_max_execution_time', '3600', 'Maximum report execution time in seconds', 'integer'),
            ('report_retention_days', '90', 'Report file retention period in days', 'integer'),
            ('report_max_file_size', '10485760', 'Maximum report file size in bytes', 'integer'),
            
            # KPI Settings
            ('kpi_default_measurement_interval', '24', 'Default KPI measurement interval in hours', 'integer'),
            ('kpi_alert_threshold_percentage', '10', 'KPI alert threshold percentage', 'decimal'),
            ('kpi_retention_days', '365', 'KPI measurement retention period in days', 'integer'),
            
            # Alert Settings
            ('alert_max_active_alerts', '100', 'Maximum active alerts', 'integer'),
            ('alert_escalation_hours', '24', 'Alert escalation time in hours', 'integer'),
        ]
        
        for key, value, description, data_type in configs:
            SystemConfiguration.set_value(key, value, description, data_type)
        
        self.stdout.write('✓ Analytics configurations initialized')

    def init_security_configs(self):
        """Initialize security configurations"""
        configs = [
            # Two-Factor Authentication
            ('two_factor_enabled', 'true', 'Enable two-factor authentication', 'boolean'),
            ('two_factor_backup_codes_count', '10', 'Number of backup codes to generate', 'integer'),
            ('two_factor_grace_period_hours', '24', '2FA grace period for new users in hours', 'integer'),
            
            # Password Policy
            ('password_min_length', '8', 'Minimum password length', 'integer'),
            ('password_require_uppercase', 'true', 'Require uppercase letters in password', 'boolean'),
            ('password_require_lowercase', 'true', 'Require lowercase letters in password', 'boolean'),
            ('password_require_numbers', 'true', 'Require numbers in password', 'boolean'),
            ('password_require_special_chars', 'true', 'Require special characters in password', 'boolean'),
            ('password_expires_days', '90', 'Password expiration in days (0 for no expiration)', 'integer'),
            ('password_prevent_reuse_count', '5', 'Number of previous passwords to prevent reuse', 'integer'),
            
            # Account Lockout
            ('max_failed_login_attempts', '5', 'Maximum failed login attempts before lockout', 'integer'),
            ('account_lockout_duration_minutes', '30', 'Account lockout duration in minutes', 'integer'),
            ('login_attempt_window_minutes', '15', 'Login attempt tracking window in minutes', 'integer'),
            
            # Session Security
            ('session_timeout_minutes', '480', 'Session timeout in minutes', 'integer'),
            ('session_secure_only', 'true', 'Require secure sessions (HTTPS)', 'boolean'),
            ('session_http_only', 'true', 'Make session cookies HTTP only', 'boolean'),
            ('session_same_site', 'Lax', 'Session cookie SameSite policy', 'string'),
            
            # Audit Logging
            ('audit_log_retention_days', '365', 'Audit log retention period in days', 'integer'),
            ('audit_log_sensitive_fields', 'password,secret_key,token', 'Comma-separated list of sensitive fields to exclude from audit logs', 'string'),
            
            # Security Monitoring
            ('security_alert_email', 'security@healthclub.com', 'Email for security alerts', 'string'),
            ('suspicious_activity_threshold', '10', 'Number of failed attempts to trigger suspicious activity alert', 'integer'),
        ]
        
        for key, value, description, data_type in configs:
            SystemConfiguration.set_value(key, value, description, data_type)
        
        self.stdout.write('✓ Security configurations initialized')
