from rest_framework import serializers
from .models import DiscountType, ReservationDiscount, DiscountRule


class DiscountTypeSerializer(serializers.ModelSerializer):
    """Serializer for DiscountType model"""
    
    applicable_services_count = serializers.SerializerMethodField()
    applicable_membership_tiers_count = serializers.SerializerMethodField()
    is_valid_now = serializers.SerializerMethodField()
    
    class Meta:
        model = DiscountType
        fields = [
            'id', 'name', 'code', 'description', 'discount_method',
            'discount_value', 'max_discount_amount', 'min_order_amount',
            'is_active', 'requires_approval', 'applicable_services',
            'applicable_membership_tiers', 'usage_limit_per_guest',
            'usage_limit_per_day', 'valid_from', 'valid_until',
            'created_by', 'created_at', 'updated_at',
            'applicable_services_count', 'applicable_membership_tiers_count',
            'is_valid_now'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_applicable_services_count(self, obj):
        return obj.applicable_services.count()
    
    def get_applicable_membership_tiers_count(self, obj):
        return obj.applicable_membership_tiers.count()
    
    def get_is_valid_now(self, obj):
        return obj.is_valid_now()


class DiscountTypeListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing discount types"""
    
    class Meta:
        model = DiscountType
        fields = [
            'id', 'name', 'code', 'discount_method', 'discount_value',
            'is_active', 'requires_approval', 'is_valid_now'
        ]
    
    def get_is_valid_now(self, obj):
        return obj.is_valid_now()


class ReservationDiscountSerializer(serializers.ModelSerializer):
    """Serializer for ReservationDiscount model"""
    
    discount_type_name = serializers.CharField(source='discount_type.name', read_only=True)
    discount_type_code = serializers.CharField(source='discount_type.code', read_only=True)
    discount_type_details = DiscountTypeSerializer(source='discount_type', read_only=True)
    applied_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    reservation_guest_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ReservationDiscount
        fields = [
            'id', 'reservation', 'discount_type', 'discount_type_name',
            'discount_type_code', 'discount_type_details', 'applied_by', 'applied_by_name',
            'approved_by', 'approved_by_name', 'original_amount',
            'discount_amount', 'final_amount', 'status', 'reason',
            'notes', 'rejection_reason', 'applied_at', 'approved_at',
            'rejected_at', 'reservation_guest_name'
        ]
        read_only_fields = [
            'applied_at', 'approved_at', 'rejected_at',
            'original_amount', 'final_amount'
        ]
    
    def get_applied_by_name(self, obj):
        if obj.applied_by:
            return f"{obj.applied_by.first_name} {obj.applied_by.last_name}".strip()
        return None
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
        return None
    
    def get_reservation_guest_name(self, obj):
        if obj.reservation and obj.reservation.guest:
            return f"{obj.reservation.guest.first_name} {obj.reservation.guest.last_name}".strip()
        return None
    
    def validate(self, data):
        # Validate discount amount doesn't exceed original amount
        if 'discount_amount' in data and 'original_amount' in data:
            if data['discount_amount'] > data['original_amount']:
                raise serializers.ValidationError(
                    "Discount amount cannot exceed original amount"
                )
        
        return data


class ReservationDiscountCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ReservationDiscount"""
    
    class Meta:
        model = ReservationDiscount
        fields = [
            'reservation', 'discount_type', 'reason', 'notes'
        ]
    
    def create(self, validated_data):
        # Calculate amounts
        reservation = validated_data['reservation']
        discount_type = validated_data['discount_type']
        
        # Get reservation total (this would need to be implemented)
        original_amount = self.get_reservation_total(reservation)
        
        # Calculate discount amount
        discount_amount = self.calculate_discount_amount(
            original_amount, discount_type
        )
        
        # Create the discount
        validated_data.update({
            'original_amount': original_amount,
            'discount_amount': discount_amount,
            'final_amount': original_amount - discount_amount,
            'applied_by': self.context['request'].user,
            'status': 'pending' if discount_type.requires_approval else 'applied'
        })
        
        return super().create(validated_data)
    
    def get_reservation_total(self, reservation):
        """Calculate total amount for reservation"""
        # This would need to be implemented based on your pricing logic
        total = 0
        for service in reservation.reservation_services.all():
            total += service.total_price
        return total
    
    def calculate_discount_amount(self, original_amount, discount_type):
        """Calculate discount amount based on type"""
        if discount_type.discount_method == 'percentage':
            discount_amount = original_amount * (discount_type.discount_value / 100)
        elif discount_type.discount_method == 'fixed_amount':
            discount_amount = discount_type.discount_value
        else:  # free_service
            discount_amount = original_amount
        
        # Apply maximum discount limit
        if discount_type.max_discount_amount:
            discount_amount = min(discount_amount, discount_type.max_discount_amount)
        
        return discount_amount


class DiscountRuleSerializer(serializers.ModelSerializer):
    """Serializer for DiscountRule model"""
    
    discount_type_name = serializers.CharField(source='discount_type.name', read_only=True)
    is_valid_now = serializers.SerializerMethodField()
    
    class Meta:
        model = DiscountRule
        fields = [
            'id', 'name', 'description', 'is_active', 'priority',
            'conditions', 'discount_type', 'discount_type_name',
            'valid_from', 'valid_until', 'created_by', 'created_at',
            'updated_at', 'is_valid_now'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_is_valid_now(self, obj):
        return obj.is_valid_now()


class DiscountApplicationSerializer(serializers.Serializer):
    """Serializer for applying discounts to reservations"""
    
    reservation_id = serializers.IntegerField()
    discount_type_id = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_reservation_id(self, value):
        """Validate reservation exists and is eligible for discount"""
        from reservations.models import Reservation
        
        try:
            reservation = Reservation.objects.get(id=value)
        except Reservation.DoesNotExist:
            raise serializers.ValidationError("Reservation not found")
        
        # Add additional validation logic here
        return value
    
    def validate_discount_type_id(self, value):
        """Validate discount type exists and is active"""
        try:
            discount_type = DiscountType.objects.get(id=value)
        except DiscountType.DoesNotExist:
            raise serializers.ValidationError("Discount type not found")
        
        if not discount_type.is_valid_now():
            raise serializers.ValidationError("Discount type is not currently valid")
        
        return value
