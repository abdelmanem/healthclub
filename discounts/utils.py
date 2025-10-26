from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from .models import DiscountType, ReservationDiscount


class DiscountCalculator:
    """
    Handles discount calculation and application logic
    """
    
    def __init__(self):
        pass
    
    def calculate_discount(self, reservation, discount_type, applied_by=None, reason='', notes=''):
        """
        Calculate and create a discount for a reservation
        
        Args:
            reservation: Reservation instance
            discount_type: DiscountType instance
            applied_by: User who applied the discount
            reason: Reason for applying the discount
            notes: Additional notes
        
        Returns:
            ReservationDiscount instance
        """
        # Validate discount eligibility
        if not self.is_eligible(reservation, discount_type):
            raise ValidationError("Discount not eligible for this reservation")
        
        # Calculate amounts
        original_amount = self.get_reservation_total(reservation)
        discount_amount = self.compute_discount_amount(original_amount, discount_type)
        
        # Apply maximum discount limit
        if discount_type.max_discount_amount:
            discount_amount = min(discount_amount, discount_type.max_discount_amount)
        
        # Determine status
        status = 'pending' if discount_type.requires_approval else 'applied'
        
        # Create discount record
        discount = ReservationDiscount.objects.create(
            reservation=reservation,
            discount_type=discount_type,
            applied_by=applied_by,
            original_amount=original_amount,
            discount_amount=discount_amount,
            final_amount=original_amount - discount_amount,
            status=status,
            reason=reason,
            notes=notes
        )
        
        return discount
    
    def is_eligible(self, reservation, discount_type):
        """
        Check if a discount can be applied to a reservation
        
        Args:
            reservation: Reservation instance
            discount_type: DiscountType instance
        
        Returns:
            bool: True if eligible, False otherwise
        """
        # Check if discount type is valid now
        if not discount_type.is_valid_now():
            return False
        
        # Check if guest can use this discount
        if not discount_type.can_be_used_by_guest(reservation.guest):
            return False
        
        # Check if discount can be used today
        if not discount_type.can_be_used_today():
            return False
        
        # Check if discount already applied to this reservation
        if ReservationDiscount.objects.filter(
            reservation=reservation,
            discount_type=discount_type
        ).exists():
            return False
        
        # Check minimum order amount
        reservation_total = self.get_reservation_total(reservation)
        if discount_type.min_order_amount and reservation_total < discount_type.min_order_amount:
            return False
        
        # Check service applicability
        if discount_type.applicable_services.exists():
            reservation_service_ids = set(
                reservation.reservation_services.values_list('service_id', flat=True)
            )
            applicable_service_ids = set(
                discount_type.applicable_services.values_list('id', flat=True)
            )
            if not reservation_service_ids.intersection(applicable_service_ids):
                return False
        
        return True
    
    def get_reservation_total(self, reservation):
        """
        Calculate total amount for a reservation
        
        Args:
            reservation: Reservation instance
        
        Returns:
            Decimal: Total amount
        """
        total = Decimal('0.00')
        
        for service in reservation.reservation_services.all():
            total += service.total_price
        
        return total
    
    def compute_discount_amount(self, original_amount, discount_type):
        """
        Compute discount amount based on discount type
        
        Args:
            original_amount: Decimal - original amount
            discount_type: DiscountType instance
        
        Returns:
            Decimal: discount amount
        """
        if discount_type.discount_method == DiscountType.DISCOUNT_METHOD_PERCENTAGE:
            discount_amount = original_amount * (discount_type.discount_value / 100)
        elif discount_type.discount_method == DiscountType.DISCOUNT_METHOD_FIXED_AMOUNT:
            discount_amount = discount_type.discount_value
        elif discount_type.discount_method == DiscountType.DISCOUNT_METHOD_FREE_SERVICE:
            discount_amount = original_amount
        else:
            discount_amount = Decimal('0.00')
        
        # Ensure discount doesn't exceed original amount
        discount_amount = min(discount_amount, original_amount)
        
        return discount_amount
    
    def get_available_discounts(self, reservation, user=None):
        """
        Get all available discounts for a reservation
        
        Args:
            reservation: Reservation instance
            user: User requesting discounts (for permission checking)
        
        Returns:
            QuerySet: Available discount types
        """
        # Get all active discount types
        discount_types = DiscountType.objects.filter(is_active=True)
        
        # Filter by eligibility
        available_discounts = []
        for discount_type in discount_types:
            if self.is_eligible(reservation, discount_type):
                available_discounts.append(discount_type)
        
        return discount_types.filter(id__in=[d.id for d in available_discounts])
    
    def apply_automatic_discounts(self, reservation):
        """
        Apply automatic discounts based on rules
        
        Args:
            reservation: Reservation instance
        
        Returns:
            list: List of applied discounts
        """
        from .models import DiscountRule
        
        applied_discounts = []
        
        # Get active rules ordered by priority
        rules = DiscountRule.objects.filter(
            is_active=True
        ).order_by('-priority')
        
        for rule in rules:
            if rule.evaluate_conditions(reservation):
                try:
                    discount = self.calculate_discount(
                        reservation=reservation,
                        discount_type=rule.discount_type,
                        reason=f"Automatic application via rule: {rule.name}"
                    )
                    applied_discounts.append(discount)
                except ValidationError:
                    # Skip if discount cannot be applied
                    continue
        
        return applied_discounts
    
    def get_discount_summary(self, reservation):
        """
        Get summary of all discounts applied to a reservation
        
        Args:
            reservation: Reservation instance
        
        Returns:
            dict: Summary information
        """
        discounts = ReservationDiscount.objects.filter(
            reservation=reservation,
            status__in=['applied', 'approved']
        )
        
        total_discount_amount = sum(discount.discount_amount for discount in discounts)
        original_total = self.get_reservation_total(reservation)
        final_total = original_total - total_discount_amount
        
        return {
            'original_total': original_total,
            'total_discount_amount': total_discount_amount,
            'final_total': final_total,
            'discount_count': discounts.count(),
            'discounts': [
                {
                    'id': discount.id,
                    'name': discount.discount_type.name,
                    'amount': discount.discount_amount,
                    'status': discount.status,
                    'applied_by': discount.applied_by.get_full_name() if discount.applied_by else None,
                    'applied_at': discount.applied_at,
                }
                for discount in discounts
            ]
        }


# Global instance
discount_calculator = DiscountCalculator()
