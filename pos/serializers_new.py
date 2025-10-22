"""
New POS Serializers with Clean Architecture
Based on POS.md analysis and recommendations
"""

from rest_framework import serializers
from decimal import Decimal
from .models import Invoice, InvoiceItem, Payment, Refund, Deposit, PaymentMethod


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer for PaymentMethod"""
    
    class Meta:
        model = PaymentMethod
        fields = ['id', 'name', 'code', 'is_active', 'requires_processing', 'processing_fee_rate']


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for InvoiceItem"""
    
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_with_tax = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'invoice', 'service', 'product_name', 'quantity', 
            'unit_price', 'tax_rate', 'notes', 'line_total', 'tax_amount', 'total_with_tax'
        ]
        read_only_fields = ['id']


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment - only positive amounts"""
    
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    processed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'payment_method', 'payment_method_name',
            'amount', 'payment_type', 'status', 'deposit',
            'transaction_id', 'reference', 'payment_date',
            'notes', 'processed_by', 'processed_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'payment_date', 'created_at', 'updated_at']
    
    def get_processed_by_name(self, obj):
        if obj.processed_by:
            return obj.processed_by.get_full_name() or obj.processed_by.username
        return None
    
    def validate_amount(self, value):
        """Ensure payment amount is positive"""
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive")
        return value


class RefundSerializer(serializers.ModelSerializer):
    """Serializer for Refund - only positive amounts"""
    
    original_payment_amount = serializers.DecimalField(
        source='original_payment.amount', 
        max_digits=12, 
        decimal_places=2, 
        read_only=True
    )
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    processed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Refund
        fields = [
            'id', 'invoice', 'original_payment', 'original_payment_amount',
            'amount', 'reason', 'refund_method', 'status',
            'transaction_id', 'reference', 'requested_by', 'requested_by_name',
            'approved_by', 'approved_by_name', 'processed_by', 'processed_by_name',
            'created_at', 'approved_at', 'processed_at', 'notes'
        ]
        read_only_fields = ['id', 'created_at', 'approved_at', 'processed_at']
    
    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None
    
    def get_processed_by_name(self, obj):
        if obj.processed_by:
            return obj.processed_by.get_full_name() or obj.processed_by.username
        return None
    
    def validate_amount(self, value):
        """Ensure refund amount is positive"""
        if value <= 0:
            raise serializers.ValidationError("Refund amount must be positive")
        return value


class DepositSerializer(serializers.ModelSerializer):
    """Serializer for Deposit"""
    
    guest_name = serializers.CharField(source='guest.get_full_name', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    can_be_applied = serializers.BooleanField(read_only=True)
    collected_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Deposit
        fields = [
            'id', 'guest', 'guest_name', 'reservation', 'reservation_id',
            'amount', 'amount_applied', 'remaining_amount', 'status',
            'payment_method', 'transaction_id', 'reference',
            'collected_at', 'collected_by', 'collected_by_name',
            'expiry_date', 'notes', 'can_be_applied',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'collected_at', 'created_at', 'updated_at']
    
    def get_collected_by_name(self, obj):
        if obj.collected_by:
            return obj.collected_by.get_full_name() or obj.collected_by.username
        return None


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for invoice list view"""
    
    guest_name = serializers.CharField(source='guest.get_full_name', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)
    payment_count = serializers.SerializerMethodField()
    refund_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'guest', 'guest_name', 'reservation', 'reservation_id',
            'date', 'due_date', 'subtotal', 'service_charge', 'tax', 'discount',
            'total', 'amount_paid', 'balance_due', 'status', 'paid_date',
            'payment_count', 'refund_count', 'created_at'
        ]
    
    def get_payment_count(self, obj):
        return obj.payments.filter(status='completed').count()
    
    def get_refund_count(self, obj):
        return obj.refunds.filter(status='processed').count()


class InvoiceSerializer(serializers.ModelSerializer):
    """Full serializer for invoice detail view"""
    
    guest_name = serializers.CharField(source='guest.get_full_name', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    
    # Nested serializers
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)
    
    # Computed fields
    payment_summary = serializers.SerializerMethodField()
    can_be_paid = serializers.BooleanField(read_only=True)
    can_be_refunded = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'guest', 'guest_name', 'reservation', 'reservation_id',
            'date', 'due_date', 'subtotal', 'service_charge', 'tax', 'discount',
            'total', 'amount_paid', 'balance_due', 'status', 'paid_date',
            'notes', 'created_by', 'created_by_name', 'version',
            'items', 'payments', 'refunds',
            'payment_summary', 'can_be_paid', 'can_be_refunded',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'invoice_number', 'date', 'subtotal', 'tax', 'total',
            'amount_paid', 'balance_due', 'paid_date', 'version',
            'created_at', 'updated_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_payment_summary(self, obj):
        """Get payment breakdown for display"""
        completed_payments = obj.payments.filter(status='completed')
        processed_refunds = obj.refunds.filter(status='processed')
        
        return {
            'total_payments': completed_payments.count(),
            'total_paid': str(obj.get_total_paid()),
            'total_refunded': str(obj.get_total_refunded()),
            'net_paid': str(obj.get_net_paid()),
            'payment_methods': list(
                completed_payments.values_list('payment_method__name', flat=True).distinct()
            ),
            'refund_count': processed_refunds.count(),
        }
    
    def create(self, validated_data):
        """Create invoice with auto-generated number"""
        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = Invoice.generate_invoice_number()
        
        # Set created_by from request context
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        
        return super().create(validated_data)


class ProcessPaymentSerializer(serializers.Serializer):
    """Serializer for processing payments"""
    
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.IntegerField()
    payment_type = serializers.ChoiceField(
        choices=Payment.PAYMENT_TYPE_CHOICES,
        default='regular'
    )
    transaction_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive")
        return value
    
    def validate_payment_method(self, value):
        try:
            PaymentMethod.objects.get(id=value, is_active=True)
        except PaymentMethod.DoesNotExist:
            raise serializers.ValidationError("Invalid payment method")
        return value


class ProcessRefundSerializer(serializers.Serializer):
    """Serializer for processing refunds"""
    
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    reason = serializers.CharField()
    refund_method = serializers.ChoiceField(choices=Refund.REFUND_METHOD_CHOICES)
    original_payment = serializers.IntegerField(required=False, allow_null=True)
    transaction_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Refund amount must be positive")
        return value
    
    def validate_original_payment(self, value):
        if value is not None:
            try:
                Payment.objects.get(id=value)
            except Payment.DoesNotExist:
                raise serializers.ValidationError("Invalid original payment")
        return value


class ApplyDepositSerializer(serializers.Serializer):
    """Serializer for applying deposits to invoices"""
    
    deposit_id = serializers.IntegerField()
    amount = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        required=False, 
        allow_null=True
    )
    
    def validate_deposit_id(self, value):
        try:
            deposit = Deposit.objects.get(id=value)
            if not deposit.can_be_applied():
                raise serializers.ValidationError("Deposit cannot be applied")
        except Deposit.DoesNotExist:
            raise serializers.ValidationError("Deposit not found")
        return value
    
    def validate_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Amount must be positive")
        return value
