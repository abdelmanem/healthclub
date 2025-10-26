from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from simple_history.models import HistoricalRecords


class DiscountType(models.Model):
    """
    Defines different types of discounts available in the system
    """
    
    DISCOUNT_METHOD_PERCENTAGE = 'percentage'
    DISCOUNT_METHOD_FIXED_AMOUNT = 'fixed_amount'
    DISCOUNT_METHOD_FREE_SERVICE = 'free_service'
    
    DISCOUNT_METHOD_CHOICES = [
        (DISCOUNT_METHOD_PERCENTAGE, 'Percentage'),
        (DISCOUNT_METHOD_FIXED_AMOUNT, 'Fixed Amount'),
        (DISCOUNT_METHOD_FREE_SERVICE, 'Free Service'),
    ]
    
    name = models.CharField(
        max_length=100,
        help_text="Display name for the discount type"
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Unique code for the discount type (e.g., 'FIRST_TIME', 'EMP_10')"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the discount"
    )
    
    # Discount calculation
    discount_method = models.CharField(
        max_length=20,
        choices=DISCOUNT_METHOD_CHOICES,
        help_text="How the discount is calculated"
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Discount value (percentage or fixed amount)"
    )
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Maximum discount amount (for percentage discounts)"
    )
    min_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Minimum order amount required for this discount"
    )
    
    # Configuration
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this discount type is currently available"
    )
    requires_approval = models.BooleanField(
        default=False,
        help_text="Whether this discount requires manager approval"
    )
    
    # Applicability
    applicable_services = models.ManyToManyField(
        'services.Service',
        blank=True,
        help_text="Services this discount applies to (empty = all services)"
    )
    applicable_membership_tiers = models.ManyToManyField(
        'config.MembershipTier',
        blank=True,
        help_text="Membership tiers this discount applies to (empty = all tiers)"
    )
    
    # Usage limits
    usage_limit_per_guest = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum times a guest can use this discount (null = unlimited)"
    )
    usage_limit_per_day = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum times this discount can be used per day (null = unlimited)"
    )
    
    # Validity period
    valid_from = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this discount becomes valid"
    )
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this discount expires"
    )
    
    # Tracking
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_discount_types'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['name']
        verbose_name = 'Discount Type'
        verbose_name_plural = 'Discount Types'
    
    def __str__(self):
        return f"{self.name} ({self.code})"
    
    def clean(self):
        super().clean()
        
        # Validate percentage discounts
        if self.discount_method == self.DISCOUNT_METHOD_PERCENTAGE:
            if self.discount_value > 100:
                raise ValidationError("Percentage discount cannot exceed 100%")
        
        # Validate validity period
        if self.valid_from and self.valid_until:
            if self.valid_from >= self.valid_until:
                raise ValidationError("Valid from date must be before valid until date")
    
    def is_valid_now(self):
        """Check if discount is currently valid"""
        now = timezone.now()
        
        if not self.is_active:
            return False
        
        if self.valid_from and now < self.valid_from:
            return False
        
        if self.valid_until and now > self.valid_until:
            return False
        
        return True
    
    def can_be_used_by_guest(self, guest):
        """Check if guest can use this discount"""
        if not self.is_valid_now():
            return False
        
        # Check membership tier eligibility
        if self.applicable_membership_tiers.exists():
            if not guest.membership_tier or guest.membership_tier not in self.applicable_membership_tiers.all():
                return False
        
        # Check usage limit per guest
        if self.usage_limit_per_guest:
            used_count = ReservationDiscount.objects.filter(
                reservation__guest=guest,
                discount_type=self,
                status__in=['applied', 'approved']
            ).count()
            
            if used_count >= self.usage_limit_per_guest:
                return False
        
        return True
    
    def can_be_used_today(self):
        """Check if discount can be used today"""
        if not self.is_valid_now():
            return False
        
        # Check daily usage limit
        if self.usage_limit_per_day:
            today = timezone.now().date()
            used_today = ReservationDiscount.objects.filter(
                discount_type=self,
                applied_at__date=today,
                status__in=['applied', 'approved']
            ).count()
            
            if used_today >= self.usage_limit_per_day:
                return False
        
        return True


class ReservationDiscount(models.Model):
    """
    Tracks discounts applied to specific reservations
    """
    
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_APPLIED = 'applied'
    STATUS_REJECTED = 'rejected'
    STATUS_CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending Approval'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_APPLIED, 'Applied'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]
    
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='discounts',
        help_text="Reservation this discount is applied to"
    )
    discount_type = models.ForeignKey(
        'discounts.DiscountType',
        on_delete=models.PROTECT,
        related_name='reservation_discounts',
        help_text="Type of discount applied"
    )
    
    # User tracking
    applied_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='applied_discounts',
        help_text="User who applied this discount"
    )
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_discounts',
        help_text="User who approved this discount (if required)"
    )
    
    # Financial tracking
    original_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Original reservation amount before discount"
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Amount of discount applied"
    )
    final_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Final amount after discount"
    )
    
    # Status and workflow
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_APPLIED,
        help_text="Current status of the discount"
    )
    
    # Additional information
    reason = models.TextField(
        blank=True,
        help_text="Reason for applying this discount"
    )
    notes = models.TextField(
        blank=True,
        help_text="Additional notes about this discount"
    )
    rejection_reason = models.TextField(
        blank=True,
        help_text="Reason for rejection (if applicable)"
    )
    
    # Timestamps
    applied_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-applied_at']
        verbose_name = 'Reservation Discount'
        verbose_name_plural = 'Reservation Discounts'
        # Allow multiple discounts per reservation but not duplicate discount types
        unique_together = ('reservation', 'discount_type')
    
    def __str__(self):
        return f"{self.discount_type.name} - {self.reservation} (${self.discount_amount})"
    
    def clean(self):
        super().clean()
        
        # Validate amounts
        if self.final_amount != (self.original_amount - self.discount_amount):
            self.final_amount = self.original_amount - self.discount_amount
        
        # Validate discount amount doesn't exceed original amount
        if self.discount_amount > self.original_amount:
            raise ValidationError("Discount amount cannot exceed original amount")
    
    def approve(self, approved_by_user, notes=''):
        """Approve a pending discount"""
        if self.status != self.STATUS_PENDING:
            raise ValidationError("Only pending discounts can be approved")
        
        self.status = self.STATUS_APPROVED
        self.approved_by = approved_by_user
        self.approved_at = timezone.now()
        if notes:
            self.notes = notes
        self.save()
    
    def reject(self, rejected_by_user, reason=''):
        """Reject a pending discount"""
        if self.status != self.STATUS_PENDING:
            raise ValidationError("Only pending discounts can be rejected")
        
        self.status = self.STATUS_REJECTED
        self.approved_by = rejected_by_user
        self.rejected_at = timezone.now()
        if reason:
            self.rejection_reason = reason
        self.save()
    
    def cancel(self, cancelled_by_user, reason=''):
        """Cancel an applied discount"""
        if self.status not in [self.STATUS_APPLIED, self.STATUS_APPROVED]:
            raise ValidationError("Only applied or approved discounts can be cancelled")
        
        self.status = self.STATUS_CANCELLED
        self.approved_by = cancelled_by_user
        self.rejected_at = timezone.now()
        if reason:
            self.rejection_reason = reason
        self.save()


class DiscountRule(models.Model):
    """
    Advanced rule engine for automatic discount application
    """
    
    name = models.CharField(
        max_length=100,
        help_text="Name of the discount rule"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of when this rule applies"
    )
    
    # Rule configuration
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rule is currently active"
    )
    priority = models.IntegerField(
        default=0,
        help_text="Higher priority rules are applied first"
    )
    
    # Rule conditions (JSON field for flexibility)
    conditions = models.JSONField(
        default=dict,
        help_text="Rule conditions in JSON format"
    )
    
    # Rule actions
    discount_type = models.ForeignKey(
        'discounts.DiscountType',
        on_delete=models.CASCADE,
        related_name='rules',
        help_text="Discount type to apply when conditions are met"
    )
    
    # Validity period
    valid_from = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this rule becomes valid"
    )
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this rule expires"
    )
    
    # Tracking
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_discount_rules'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-priority', 'name']
        verbose_name = 'Discount Rule'
        verbose_name_plural = 'Discount Rules'
    
    def __str__(self):
        return f"{self.name} (Priority: {self.priority})"
    
    def is_valid_now(self):
        """Check if rule is currently valid"""
        now = timezone.now()
        
        if not self.is_active:
            return False
        
        if self.valid_from and now < self.valid_from:
            return False
        
        if self.valid_until and now > self.valid_until:
            return False
        
        return True
    
    def evaluate_conditions(self, reservation):
        """Evaluate if rule conditions are met for a reservation"""
        if not self.is_valid_now():
            return False
        
        # This would be implemented based on the specific conditions format
        # For now, return True as a placeholder
        return True
