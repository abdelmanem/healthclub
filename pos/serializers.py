from rest_framework import serializers
from decimal import Decimal
from .models import Invoice, InvoiceItem, Payment, PaymentMethod, Refund


class PaymentMethodSerializer(serializers.ModelSerializer):
    """
    Serializer for PaymentMethod
    
    Used in dropdowns/selectors for choosing payment method
    
    Example response:
    {
        "id": 1,
        "name": "Credit Card",
        "code": "credit_card",
        "requires_reference": true,
        "icon": "💳"
    }
    """
    
    class Meta:
        model = PaymentMethod
        fields = [
            'id',
            'name',
            'code',
            'requires_reference',
            'icon',
            'display_order'
        ]
        read_only_fields = ['id']


class InvoiceItemSerializer(serializers.ModelSerializer):
    """
    Serializer for invoice line items
    
    Includes:
    - Service details (if linked)
    - Auto-calculated line total
    - Tax calculation
    
    Example:
    {
        "id": 1,
        "service": 5,
        "service_name": "Swedish Massage 60min",
        "product_name": "Swedish Massage 60min",
        "quantity": 1,
        "unit_price": "80.00",
        "tax_rate": "8.00",
        "line_total": "80.00",
        "tax_amount": "6.40",
        "total_with_tax": "86.40"
    }
    """
    
    service_name = serializers.CharField(
        source='service.name',
        read_only=True,
        help_text="Name of linked service (if any)"
    )
    
    tax_amount = serializers.SerializerMethodField(
        help_text="Calculated tax for this line item"
    )
    
    total_with_tax = serializers.SerializerMethodField(
        help_text="Line total including tax"
    )
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'service',
            'service_name',
            'product_name',
            'quantity',
            'unit_price',
            'tax_rate',
            'line_total',
            'tax_amount',
            'total_with_tax',
            'notes',
        ]
        read_only_fields = ['id', 'line_total', 'service_name']
    
    def get_tax_amount(self, obj):
        """Calculate tax for this item"""
        return str(obj.get_tax_amount())
    
    def get_total_with_tax(self, obj):
        """Calculate total with tax"""
        return str(obj.get_total_with_tax())
    
    def validate_quantity(self, value):
        """Ensure quantity is positive"""
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1")
        return value
    
    def validate_unit_price(self, value):
        """Ensure unit price is not negative"""
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative")
        return value


class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer for payments
    
    Includes:
    - Invoice and guest details
    - Payment method info
    - Processor info
    - Formatted display values
    
    Example:
    {
        "id": 1,
        "invoice": 42,
        "invoice_number": "INV-000042",
        "guest_name": "John Smith",
        "method": "credit_card",
        "payment_method": 2,
        "payment_method_name": "Credit Card",
        "payment_type": "full",
        "amount": "108.00",
        "display_amount": "$108.00",
        "transaction_id": "TXN-123456",
        "reference": "VISA-4532",
        "payment_date": "2025-01-15T14:30:00Z",
        "status": "completed",
        "notes": "Paid by Visa ending in 4532",
        "processed_by": 5,
        "processed_by_name": "Jane Doe",
        "is_refund": false
    }
    """
    
    # Computed fields
    invoice_number = serializers.CharField(
        source='invoice.invoice_number',
        read_only=True
    )
    
    guest_name = serializers.SerializerMethodField()
    
    payment_method_name = serializers.CharField(
        source='payment_method.name',
        read_only=True
    )
    
    processed_by_name = serializers.SerializerMethodField()
    
    display_amount = serializers.SerializerMethodField(
        help_text="Formatted amount for display"
    )
    
    is_refund = serializers.SerializerMethodField(
        help_text="True if this is a refund"
    )
    
    # Enrichments: refund info and linked refunds
    refund_info = serializers.SerializerMethodField(
        help_text="Details about refunds on this payment"
    )
    refunds = serializers.SerializerMethodField(
        help_text="List of Refund records linked to this payment"
    )

    class Meta:
        model = Payment
        fields = [
            'id',
            'invoice',
            'invoice_number',
            'guest_name',
            'method',
            'payment_method',
            'payment_method_name',
            'payment_type',
            'amount',
            'display_amount',
            'transaction_id',
            'reference',
            'payment_date',
            'status',
            'notes',
            'processed_by',
            'processed_by_name',
            'is_refund',
            'is_refunded',
            'refund_amount',
            'refund_date',
            'refund_reason',
            'refund_info',
            'refunds',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'payment_date',
            'created_at',
            'updated_at',
            'invoice_number',
            'guest_name',
            'payment_method_name',
            'processed_by_name',
            'display_amount',
            'is_refund',
            'is_refunded',
            'refund_amount',
            'refund_date',
            'refund_reason',
            'refund_info',
            'refunds',
        ]
    
    def get_guest_name(self, obj):
        """Get formatted guest name"""
        if obj.invoice and obj.invoice.guest:
            guest = obj.invoice.guest
            return f"{guest.first_name} {guest.last_name}".strip()
        return None
    
    def get_processed_by_name(self, obj):
        """Get staff member name who processed payment"""
        if obj.processed_by:
            return obj.processed_by.get_full_name() or obj.processed_by.username
        return None
    
    def get_display_amount(self, obj):
        """Get formatted amount with currency symbol"""
        return obj.get_display_amount()
    
    def get_is_refund(self, obj):
        """Check if this is a refund"""
        return obj.is_refund()

    def get_refund_info(self, obj):
        """Return aggregate refund info if any refunds applied to this payment"""
        if not obj.is_refunded and obj.refund_amount == 0:
            return None
        return {
            'is_refunded': obj.is_refunded,
            'refund_amount': str(obj.refund_amount),
            'remaining_amount': str(obj.amount - obj.refund_amount),
            'refund_date': obj.refund_date,
            'refund_reason': obj.refund_reason,
            'can_be_refunded': obj.can_be_refunded(),
        }

    def get_refunds(self, obj):
        """Return linked Refund records (minimal fields)"""
        qs = obj.refunds.all().order_by('-created_at')
        return [
            {
                'id': r.id,
                'amount': str(r.amount),
                'reason': r.reason,
                'status': r.status,
                'created_at': r.created_at,
                'processed_at': r.processed_at,
            }
            for r in qs
        ]
    
    def validate_amount(self, value):
        """Validate payment amount"""
        if value == 0:
            raise serializers.ValidationError("Payment amount cannot be zero")
        return value
    
    def validate(self, data):
        """
        Cross-field validation
        
        Rules:
        1. Refunds must have negative amounts
        2. Regular payments must have positive amounts
        3. If payment method requires reference, it must be provided
        """
        payment_type = data.get('payment_type')
        amount = data.get('amount')
        payment_method = data.get('payment_method')
        reference = data.get('reference', '')
        
        # Validate refund amounts
        if payment_type == 'refund' and amount > 0:
            raise serializers.ValidationError({
                'amount': 'Refund amount must be negative'
            })
        
        # Validate regular payment amounts
        if payment_type != 'refund' and amount < 0:
            raise serializers.ValidationError({
                'amount': 'Payment amount must be positive'
            })
        
        # Check if reference number is required
        if payment_method and payment_method.requires_reference and not reference:
            raise serializers.ValidationError({
                'reference': f'{payment_method.name} requires a reference number'
            })
        
        return data


class InvoiceSerializer(serializers.ModelSerializer):
    """
    Main invoice serializer
    
    Features:
    - Nested items (read/write)
    - Nested payments (read-only)
    - Auto-calculation of totals
    - Guest and reservation details
    - Payment summary
    
    Full example response:
    {
        "id": 42,
        "invoice_number": "INV-000042",
        "guest": 15,
        "guest_name": "John Smith",
        "guest_email": "john@example.com",
        "reservation": 100,
        "reservation_id": 100,
        "date": "2025-01-15T14:00:00Z",
        "due_date": "2025-01-15",
        "subtotal": "100.00",
        "tax": "8.00",
        "discount": "0.00",
        "total": "108.00",
        "amount_paid": "108.00",
        "balance_due": "0.00",
        "status": "paid",
        "paid_date": "2025-01-15T14:30:00Z",
        "notes": "",
        "items": [
            {
                "id": 1,
                "product_name": "Swedish Massage 60min",
                "quantity": 1,
                "unit_price": "80.00",
                "tax_rate": "8.00",
                "line_total": "80.00"
            },
            {
                "id": 2,
                "product_name": "Aromatherapy Add-on",
                "quantity": 1,
                "unit_price": "20.00",
                "tax_rate": "8.00",
                "line_total": "20.00"
            }
        ],
        "payments": [
            {
                "id": 1,
                "amount": "108.00",
                "method": "credit_card",
                "payment_date": "2025-01-15T14:30:00Z",
                "status": "completed"
            }
        ],
        "payment_summary": {
            "total_payments": 1,
            "payment_methods": ["credit_card"],
            "refund_amount": "0.00"
        },
        "can_be_paid": false,
        "can_be_refunded": true
    }
    """
    
    # Nested serializers
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    
    # Computed fields
    guest_name = serializers.SerializerMethodField()
    guest_email = serializers.CharField(source='guest.email', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)
    
    payment_summary = serializers.SerializerMethodField(
        help_text="Summary of all payments"
    )
    
    can_be_paid = serializers.SerializerMethodField(
        help_text="Whether this invoice can accept payments"
    )
    
    can_be_refunded = serializers.SerializerMethodField(
        help_text="Whether this invoice can be refunded"
    )
    
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'guest',
            'guest_name',
            'guest_email',
            'reservation',
            'reservation_id',
            'date',
            'due_date',
            'subtotal',
            'tax',
            'service_charge',
            'discount',
            'total',
            'amount_paid',
            'balance_due',
            'status',
            'paid_date',
            'notes',
            'items',
            'payments',
            'payment_summary',
            'can_be_paid',
            'can_be_refunded',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'date',
            'invoice_number',
            'subtotal',
            'tax',
            'service_charge',
            'total',
            'amount_paid',
            'balance_due',
            'paid_date',
            'created_at',
            'updated_at',
            'guest_name',
            'guest_email',
            'reservation_id',
            'payment_summary',
            'can_be_paid',
            'can_be_refunded',
            'created_by_name',
        ]
    
    def get_guest_name(self, obj):
        """Get formatted guest name"""
        if obj.guest:
            return f"{obj.guest.first_name} {obj.guest.last_name}".strip()
        return None
    
    def get_payment_summary(self, obj):
        """Get payment summary statistics"""
        return obj.get_payment_summary()
    
    def get_can_be_paid(self, obj):
        """Check if invoice can accept payments"""
        return obj.can_be_paid()
    
    def get_can_be_refunded(self, obj):
        """Check if invoice can be refunded"""
        return obj.can_be_refunded()
    
    def get_created_by_name(self, obj):
        """Get staff member who created invoice"""
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def validate_discount(self, value):
        """Validate discount amount"""
        if value < 0:
            raise serializers.ValidationError("Discount cannot be negative")
        return value
    
    def create(self, validated_data):
        """
        Create invoice with nested items
        
        Process:
        1. Extract items data from payload
        2. Generate invoice number if not provided
        3. Set created_by from request user
        4. Create invoice record
        5. Create all invoice items
        6. Recalculate totals
        
        Example request:
        POST /api/invoices/
        {
            "guest": 15,
            "reservation": 100,
            "discount": "5.00",
            "notes": "VIP guest - 5% discount applied",
            "items": [
                {
                    "product_name": "Swedish Massage 60min",
                    "quantity": 1,
                    "unit_price": "80.00",
                    "tax_rate": "8.00"
                },
                {
                    "product_name": "Aromatherapy",
                    "quantity": 1,
                    "unit_price": "20.00",
                    "tax_rate": "8.00"
                }
            ]
        }
        """
        items_data = validated_data.pop('items', [])
        
        # Generate invoice number if not provided
        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = Invoice.generate_invoice_number()
        
        # Set created_by from request context
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        
        # Create invoice
        invoice = Invoice.objects.create(**validated_data)
        
        # Create invoice items
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        # Recalculate totals (includes tax calculation)
        invoice.recalculate_totals()
        
        return invoice
    
    def update(self, instance, validated_data):
        """
        Update invoice and items
        
        Process:
        1. Extract items data
        2. Update invoice fields
        3. Delete existing items
        4. Create new items from payload
        5. Recalculate totals
        
        Note: This replaces all items. For partial updates, use PATCH on individual items.
        
        Example request:
        PATCH /api/invoices/42/
        {
            "discount": "10.00",
            "notes": "Applied 10% loyalty discount",
            "items": [
                {
                    "product_name": "Swedish Massage 90min",
                    "quantity": 1,
                    "unit_price": "120.00",
                    "tax_rate": "8.00"
                }
            ]
        }
        """
        items_data = validated_data.pop('items', None)
        
        # Update invoice fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update items if provided
        if items_data is not None:
            # Delete existing items
            instance.items.all().delete()
            
            # Create new items
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)
        
        # Recalculate totals
        instance.recalculate_totals()
        
        return instance


class InvoiceListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for invoice lists
    
    Used in list views where full details aren't needed
    Improves performance by avoiding nested queries
    
    Example:
    {
        "id": 42,
        "invoice_number": "INV-000042",
        "guest_name": "John Smith",
        "date": "2025-01-15T14:00:00Z",
        "total": "108.00",
        "balance_due": "0.00",
        "status": "paid"
    }
    """
    
    guest_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'guest',
            'guest_name',
            'reservation',
            'date',
            'total',
            'amount_paid',
            'balance_due',
            'status',
        ]
    
    def get_guest_name(self, obj):
        if obj.guest:
            return f"{obj.guest.first_name} {obj.guest.last_name}".strip()
        return None


class ProcessPaymentSerializer(serializers.Serializer):
    """
    Serializer for payment processing endpoint
    
    Used in: POST /api/invoices/{id}/process-payment/
    
    Example request:
    {
        "amount": "108.00",
        "payment_method": 2,
        "payment_type": "full",
        "reference": "VISA-4532",
        "transaction_id": "TXN-123456",
        "notes": "Paid by Visa ending in 4532"
    }
    """
    
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True,
        help_text="Payment amount (must be positive)"
    )
    
    payment_method = serializers.IntegerField(
        required=True,
        help_text="ID of payment method"
    )
    
    payment_type = serializers.ChoiceField(
        choices=['full', 'partial', 'deposit'],
        default='full',
        help_text="Type of payment"
    )
    
    reference = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Reference number (check #, last 4 of card, etc.)"
    )
    
    transaction_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Transaction ID from payment processor"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Additional notes about this payment"
    )

    # Phase 1: Idempotency key to prevent duplicate submissions
    idempotency_key = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Unique key to prevent duplicate submissions"
    )
    
    def validate_payment_method(self, value):
        """Ensure payment method exists and is active"""
        try:
            payment_method = PaymentMethod.objects.get(id=value, is_active=True)
            return payment_method
        except PaymentMethod.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive payment method")
    
    def validate(self, data):
        """Cross-field validation"""
        payment_method = data.get('payment_method')
        reference = data.get('reference', '')
        
        # Check if reference is required
        if payment_method and payment_method.requires_reference and not reference:
            raise serializers.ValidationError({
                'reference': f'{payment_method.name} requires a reference number'
            })
        
        return data


class RefundSerializer(serializers.Serializer):
    """
    Serializer for refund processing
    
    Used in: POST /api/invoices/{id}/refund/
    
    Example request:
    {
        "amount": "50.00",
        "reason": "Guest cancelled - partial refund per policy",
        "payment_method": "credit_card"
    }
    """
    
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True,
        help_text="Refund amount (positive number)"
    )
    
    reason = serializers.CharField(
        required=True,
        help_text="Reason for refund"
    )
    
    payment_method = serializers.CharField(
        max_length=50,
        required=False,
        default='refund',
        help_text="How refund will be issued"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Additional notes"
    )

    # Phase 1: Optional link to a specific payment to refund against
    payment_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="ID of specific payment to refund (optional)"
    )

    def validate_payment_id(self, value):
        """Validate payment exists if provided"""
        if value:
            try:
                payment = Payment.objects.get(id=value)
                # Ensure payment can be refunded (positive, completed, not already fully refunded)
                if not payment.can_be_refunded():
                    raise serializers.ValidationError("This payment cannot be refunded")
                return payment
            except Payment.DoesNotExist:
                raise serializers.ValidationError("Payment not found")
        return None


class RefundModelSerializer(serializers.ModelSerializer):
    """
    Serializer for the Refund model with helpful computed fields
    """
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    guest_name = serializers.SerializerMethodField()
    original_payment_amount = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Refund
        fields = [
            'id',
            'invoice',
            'invoice_number',
            'guest_name',
            'payment',
            'original_payment_amount',
            'amount',
            'reason',
            'status',
            'status_display',
            'requested_by',
            'requested_by_name',
            'approved_by',
            'approved_by_name',
            'created_at',
            'processed_at',
        ]
        read_only_fields = [
            'id', 'invoice_number', 'guest_name', 'original_payment_amount',
            'requested_by_name', 'approved_by_name', 'status_display',
            'created_at', 'processed_at'
        ]

    def get_guest_name(self, obj):
        if obj.invoice and obj.invoice.guest:
            g = obj.invoice.guest
            return f"{g.first_name} {g.last_name}".strip()
        return None

    def get_original_payment_amount(self, obj):
        if obj.payment and obj.payment.amount > 0:
            return str(obj.payment.amount)
        return None

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

