# 📦 PHASE 2: ESSENTIAL OPERATIONAL FEATURES - COMPLETE IMPLEMENTATION GUIDE

## Overview
This document contains all code changes needed to implement essential operational features for your POS system.

**Prerequisites:** Phase 1 must be completed and stable  
**Total Estimated Time:** 1 week  
**Priority:** 🟡 ESSENTIAL - Required for complete operations

---

## Table of Contents
1. [Receipt Generation System](#1-receipt-generation-system)
2. [Split Payment Support](#2-split-payment-support)
3. [Tip/Gratuity Handling](#3-tipgratuity-handling)
4. [Gift Card Integration](#4-gift-card-integration)
5. [Promotional Code Application](#5-promotional-code-application)
6. [Testing Instructions](#6-testing-instructions)
7. [Deployment Guide](#7-deployment-guide)

---

## 1. Receipt Generation System

### 1.1 Database Migration

**File:** `pos/migrations/0003_receipt_fields.py`

```python
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0002_add_critical_fields'),
    ]

    operations = [
        # Add receipt tracking to Invoice
        migrations.AddField(
            model_name='invoice',
            name='receipt_number',
            field=models.CharField(
                max_length=50,
                unique=True,
                null=True,
                blank=True,
                help_text='Unique receipt number'
            ),
        ),
        
        migrations.AddField(
            model_name='invoice',
            name='receipt_sent_at',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text='When receipt was last sent to guest'
            ),
        ),
        
        migrations.AddField(
            model_name='invoice',
            name='receipt_sent_to',
            field=models.EmailField(
                max_length=254,
                blank=True,
                help_text='Email address receipt was sent to'
            ),
        ),
        
        # Create Receipt model for tracking all receipt generations
        migrations.CreateModel(
            name='Receipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('receipt_number', models.CharField(max_length=50, unique=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipts', to='pos.invoice')),
                ('receipt_type', models.CharField(
                    choices=[('payment', 'Payment Receipt'), ('refund', 'Refund Receipt'), ('invoice', 'Invoice')],
                    default='payment',
                    max_length=20
                )),
                ('delivery_method', models.CharField(
                    choices=[('email', 'Email'), ('print', 'Print'), ('sms', 'SMS'), ('download', 'Download')],
                    default='email',
                    max_length=20
                )),
                ('recipient_email', models.EmailField(blank=True, max_length=254)),
                ('recipient_phone', models.CharField(blank=True, max_length=20)),
                ('file_path', models.CharField(blank=True, max_length=500, help_text='Path to generated PDF')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('sent_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='accounts.user'
                )),
                ('is_sent', models.BooleanField(default=False)),
                ('send_error', models.TextField(blank=True)),
            ],
            options={
                'ordering': ['-sent_at'],
                'verbose_name': 'Receipt',
                'verbose_name_plural': 'Receipts',
            },
        ),
    ]
```

### 1.2 Models Update

**File:** `pos/models.py` (Add Receipt model)

```python
class Receipt(models.Model):
    """
    Track all receipt generations and deliveries
    """
    
    RECEIPT_TYPE_CHOICES = [
        ('payment', 'Payment Receipt'),
        ('refund', 'Refund Receipt'),
        ('invoice', 'Invoice'),
    ]
    
    DELIVERY_METHOD_CHOICES = [
        ('email', 'Email'),
        ('print', 'Print'),
        ('sms', 'SMS'),
        ('download', 'Download'),
    ]
    
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='receipts'
    )
    
    receipt_number = models.CharField(
        max_length=50,
        unique=True
    )
    
    receipt_type = models.CharField(
        max_length=20,
        choices=RECEIPT_TYPE_CHOICES,
        default='payment'
    )
    
    delivery_method = models.CharField(
        max_length=20,
        choices=DELIVERY_METHOD_CHOICES,
        default='email'
    )
    
    recipient_email = models.EmailField(blank=True)
    recipient_phone = models.CharField(max_length=20, blank=True)
    
    file_path = models.CharField(
        max_length=500,
        blank=True,
        help_text='Path to generated PDF'
    )
    
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    is_sent = models.BooleanField(default=False)
    send_error = models.TextField(blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-sent_at']
        verbose_name = 'Receipt'
        verbose_name_plural = 'Receipts'
    
    def __str__(self):
        return f"Receipt {self.receipt_number} - {self.invoice.invoice_number}"
    
    @staticmethod
    def generate_receipt_number(invoice):
        """Generate unique receipt number"""
        timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
        return f"REC-{invoice.id}-{timestamp}"


# Update Invoice model
class Invoice(models.Model):
    # ... existing fields ...
    
    # NEW: Receipt tracking fields
    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        help_text='Unique receipt number'
    )
    
    receipt_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When receipt was last sent to guest'
    )
    
    receipt_sent_to = models.EmailField(
        blank=True,
        help_text='Email address receipt was sent to'
    )
    
    # ... rest of existing fields ...
```

### 1.3 Receipt Generator Utility

**File:** `pos/utils/receipt_generator.py` (NEW FILE)

```python
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from io import BytesIO
from decimal import Decimal
import os

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
    print("WARNING: WeasyPrint not installed. PDF generation will not work.")
    print("Install with: pip install weasyprint")


class ReceiptGenerator:
    """
    Generate and deliver receipts in various formats
    """
    
    def __init__(self, invoice):
        self.invoice = invoice
        self.guest = invoice.guest
        self.items = invoice.items.all()
        self.payments = invoice.payments.filter(status='completed')
        
    def generate_context(self):
        """Generate template context for receipt"""
        from pos.models import PosConfig
        
        config = PosConfig.objects.first()
        
        context = {
            'invoice': self.invoice,
            'guest': self.guest,
            'items': self.items,
            'payments': self.payments,
            'company_name': getattr(settings, 'COMPANY_NAME', 'Spa & Wellness Center'),
            'company_address': getattr(settings, 'COMPANY_ADDRESS', ''),
            'company_phone': getattr(settings, 'COMPANY_PHONE', ''),
            'company_email': getattr(settings, 'COMPANY_EMAIL', ''),
            'company_website': getattr(settings, 'COMPANY_WEBSITE', ''),
            'vat_rate': config.vat_rate if config else Decimal('0.00'),
            'service_charge_rate': config.service_charge_rate if config else Decimal('0.00'),
        }
        
        return context
    
    def generate_html(self):
        """Generate HTML receipt"""
        context = self.generate_context()
        html = render_to_string('receipts/invoice_receipt.html', context)
        return html
    
    def generate_pdf(self, save_path=class GiftCardViewSet(viewsets.ModelViewSet):
    """
    ViewSet for gift card management
    
    Endpoints:
    - GET /api/gift-cards/              - List all gift cards
    - POST /api/gift-cards/             - Create new gift card
    - GET /api/gift-cards/{id}/         - Get gift card details
    - PATCH /api/gift-cards/{id}/       - Update gift card
    - POST /api/gift-cards/{id}/check-balance/ - Check balance
    - POST /api/gift-cards/{id}/use/    - Use gift card for payment
    - POST /api/gift-cards/{id}/activate/ - Activate gift card
    - POST /api/gift-cards/{id}/deactivate/ - Deactivate gift card
    """
    
    queryset = GiftCard.objects.all().select_related('guest', 'issued_by')
    serializer_class = GiftCardSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'guest__first_name', 'guest__last_name']
    ordering = ['-issued_date']
    
    def get_queryset(self):
        """Filter gift cards"""
        queryset = super().get_queryset()
        
        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Filter by guest
        guest_id = self.request.query_params.get('guest')
        if guest_id:
            queryset = queryset.filter(guest_id=guest_id)
        
        # Filter by expiry
        show_expired = self.request.query_params.get('show_expired')
        if show_expired != 'true':
            queryset = queryset.filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=timezone.now())
            )
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def check_balance(self, request, pk=None):
        """
        Check gift card balance
        
        Endpoint: GET /api/gift-cards/{id}/check-balance/
        """
        gift_card = self.get_object()
        
        # Check if expired
        is_expired = False
        if gift_card.expiry_date and gift_card.expiry_date < timezone.now():
            is_expired = True
        
        return Response({
            'code': gift_card.code,
            'original_amount': str(gift_card.original_amount),
            'remaining_amount': str(gift_card.remaining_amount),
            'status': gift_card.status,
            'is_expired': is_expired,
            'expiry_date': gift_card.expiry_date,
            'can_be_used': gift_card.status == 'active' and not is_expired and gift_card.remaining_amount > 0
        })
    
    @action(detail=True, methods=['post'])
    def use(self, request, pk=None):
        """
        Use gift card for payment
        
        Endpoint: POST /api/gift-cards/{id}/use/
        
        Request body:
        {
            "invoice": 42,
            "amount": "50.00"
        }
        """
        gift_card = self.get_object()
        
        # Validate request
        invoice_id = request.data.get('invoice')
        amount = request.data.get('amount')
        
        if not invoice_id or not amount:
            return Response({
                'error': 'Both invoice and amount are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid amount'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate gift card
        if gift_card.status != 'active':
            return Response({
                'error': f'Gift card is {gift_card.status}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if gift_card.expiry_date and gift_card.expiry_date < timezone.now():
            return Response({
                'error': 'Gift card has expired'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if amount > gift_card.remaining_amount:
            return Response({
                'error': f'Insufficient balance. Available: ${gift_card.remaining_amount}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Get invoice
                invoice = Invoice.objects.select_for_update().get(pk=invoice_id)
                
                # Validate amount doesn't exceed balance due
                if amount > invoice.balance_due:
                    return Response({
                        'error': f'Amount exceeds invoice balance due (${invoice.balance_due})'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Get or create gift card payment method
                payment_method, _ = PaymentMethod.objects.get_or_create(
                    code='gift_card',
                    defaults={
                        'name': 'Gift Card',
                        'is_active': True,
                        'requires_reference': True
                    }
                )
                
                # Create payment
                payment = Payment.objects.create(
                    invoice=invoice,
                    method='gift_card',
                    payment_method=payment_method,
                    payment_type='full' if amount >= invoice.balance_due else 'partial',
                    amount=amount,
                    reference=gift_card.code,
                    status='completed',
                    notes=f'Paid with Gift Card: {gift_card.code}',
                    processed_by=request.user
                )
                
                # Deduct from gift card
                gift_card.use_amount(amount)
                
                invoice.refresh_from_db()
        
        except Invoice.DoesNotExist:
            return Response({
                'error': 'Invoice not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': True,
            'payment_id': payment.id,
            'amount_used': str(amount),
            'gift_card_remaining': str(gift_card.remaining_amount),
            'gift_card_status': gift_card.status,
            'invoice_balance_due': str(invoice.balance_due),
            'message': f'Gift card payment of ${amount} processed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activate a gift card
        
        Endpoint: POST /api/gift-cards/{id}/activate/
        """
        gift_card = self.get_object()
        
        if gift_card.status == 'active':
            return Response({
                'error': 'Gift card is already active'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        gift_card.status = 'active'
        gift_card.save(update_fields=['status'])
        
        return Response({
            'success': True,
            'code': gift_card.code,
            'status': gift_card.status,
            'message': 'Gift card activated successfully'
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """
        Deactivate a gift card
        
        Endpoint: POST /api/gift-cards/{id}/deactivate/
        """
        gift_card = self.get_object()
        
        reason = request.data.get('reason', '')
        
        gift_card.status = 'cancelled'
        gift_card.notes = f"{gift_card.notes}\nDeactivated: {reason}".strip()
        gift_card.save(update_fields=['status', 'notes'])
        
        return Response({
            'success': True,
            'code': gift_card.code,
            'status': gift_card.status,
            'message': 'Gift card deactivated successfully'
        })
    
    @action(detail=False, methods=['post'])
    def check_by_code(self, request):
        """
        Check gift card balance by code
        
        Endpoint: POST /api/gift-cards/check-by-code/
        
        Request body:
        {
            "code": "GC-123456"
        }
        """
        code = request.data.get('code')
        
        if not code:
            return Response({
                'error': 'Gift card code is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            gift_card = GiftCard.objects.get(code=code)
        except GiftCard.DoesNotExist:
            return Response({
                'error': 'Gift card not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if expired
        is_expired = False
        if gift_card.expiry_date and gift_card.expiry_date < timezone.now():
            is_expired = True
        
        return Response({
            'id': gift_card.id,
            'code': gift_card.code,
            'original_amount': str(gift_card.original_amount),
            'remaining_amount': str(gift_card.remaining_amount),
            'status': gift_card.status,
            'is_expired': is_expired,
            'expiry_date': gift_card.expiry_date,
            'can_be_used': gift_card.status == 'active' and not is_expired and gift_card.remaining_amount > 0
        })


class GiftCardSerializer(serializers.ModelSerializer):
    """Serializer for gift cards"""
    
    guest_name = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_be_used = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = GiftCard
        fields = [
            'id',
            'code',
            'guest',
            'guest_name',
            'original_amount',
            'remaining_amount',
            'status',
            'status_display',
            'issued_date',
            'expiry_date',
            'issued_by',
            'issued_by_name',
            'notes',
            'can_be_used',
            'is_expired',
        ]
        read_only_fields = [
            'id',
            'issued_date',
            'guest_name',
            'issued_by_name',
            'status_display',
            'can_be_used',
            'is_expired',
        ]
    
    def get_guest_name(self, obj):
        if obj.guest:
            return f"{obj.guest.first_name} {obj.guest.last_name}"
        return None
    
    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return None
    
    def get_can_be_used(self, obj):
        is_expired = obj.expiry_date and obj.expiry_date < timezone.now()
        return obj.status == 'active' and not is_expired and obj.remaining_amount > 0
    
    def get_is_expired(self, obj):
        return obj.expiry_date and obj.expiry_date < timezone.now()
    
    def validate_code(self, value):
        """Ensure code is unique"""
        if self.instance:
            # Updating existing
            if GiftCard.objects.filter(code=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("Gift card with this code already exists")
        else:
            # Creating new
            if GiftCard.objects.filter(code=value).exists():
                raise serializers.ValidationError("Gift card with this code already exists")
        return value
    
    def create(self, validated_data):
        """Generate code if not provided"""
        if 'code' not in validated_data or not validated_data['code']:
            import random
            import string
            validated_data['code'] = 'GC-' + ''.join(
                random.choices(string.ascii_uppercase + string.digits, k=10)
            )
        
        # Set remaining_amount to original_amount
        validated_data['remaining_amount'] = validated_data['original_amount']
        
        # Set issued_by from request
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['issued_by'] = request.user
        
        return super().create(validated_data)
```

---

## 5. Promotional Code Application

### 5.1 Serializers for Promo Codes

**File:** `pos/serializers.py`

```python
class PromotionalCodeSerializer(serializers.ModelSerializer):
    """Serializer for promotional codes"""
    
    code_type_display = serializers.CharField(source='get_code_type_display', read_only=True)
    is_valid = serializers.SerializerMethodField()
    applicable_service_names = serializers.SerializerMethodField()
    
    class Meta:
        model = PromotionalCode
        fields = [
            'id',
            'code',
            'description',
            'code_type',
            'code_type_display',
            'discount_value',
            'min_purchase_amount',
            'max_discount_amount',
            'usage_limit',
            'used_count',
            'is_active',
            'valid_from',
            'valid_until',
            'applicable_services',
            'applicable_service_names',
            'is_valid',
        ]
        read_only_fields = [
            'id',
            'used_count',
            'code_type_display',
            'is_valid',
            'applicable_service_names',
        ]
    
    def get_is_valid(self, obj):
        return obj.is_valid()
    
    def get_applicable_service_names(self, obj):
        return [service.name for service in obj.applicable_services.all()]


class ApplyPromoCodeSerializer(serializers.Serializer):
    """Serializer for applying promo code to invoice"""
    
    promo_code = serializers.CharField(
        max_length=50,
        help_text="Promotional code to apply"
    )
    
    def validate_promo_code(self, value):
        """Validate promo code exists and is valid"""
        try:
            promo = PromotionalCode.objects.get(code=value.upper())
        except PromotionalCode.DoesNotExist:
            raise serializers.ValidationError("Invalid promotional code")
        
        if not promo.is_valid():
            if not promo.is_active:
                raise serializers.ValidationError("This promotional code is no longer active")
            elif timezone.now() < promo.valid_from:
                raise serializers.ValidationError("This promotional code is not yet valid")
            elif timezone.now() > promo.valid_until:
                raise serializers.ValidationError("This promotional code has expired")
            elif promo.usage_limit and promo.used_count >= promo.usage_limit:
                raise serializers.ValidationError("This promotional code has reached its usage limit")
        
        return promo
```

### 5.2 Views for Promo Codes

**File:** `pos/views.py` (Add to InvoiceViewSet)

```python
@action(detail=True, methods=['post'])
def apply_promo_code(self, request, pk=None):
    """
    Apply promotional code to invoice
    
    Endpoint: POST /api/invoices/{id}/apply-promo-code/
    
    Request body:
    {
        "promo_code": "SUMMER20"
    }
    """
    invoice = self.get_object()
    
    # Validate request
    serializer = ApplyPromoCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    promo = serializer.validated_data['promo_code']
    
    # Check minimum purchase amount
    if invoice.subtotal < promo.min_purchase_amount:
        return Response({
            'error': f'Minimum purchase amount of ${promo.min_purchase_amount} required',
            'min_purchase': str(promo.min_purchase_amount),
            'current_subtotal': str(invoice.subtotal)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if promo code applies to invoice items
    if promo.applicable_services.exists():
        invoice_services = set(
            item.service_id for item in invoice.items.all() 
            if item.service_id
        )
        applicable_services = set(
            promo.applicable_services.values_list('id', flat=True)
        )
        
        if not invoice_services.intersection(applicable_services):
            return Response({
                'error': 'This promotional code does not apply to any services in this invoice',
                'applicable_services': [s.name for s in promo.applicable_services.all()]
            }, status=status.HTTP_400_BAD_REQUEST)
    
    # Calculate discount
    discount_amount = promo.apply_discount(invoice.subtotal)
    
    # Apply discount to invoice
    previous_total = invoice.total
    invoice.discount = discount_amount
    
    # Add promo code to notes
    invoice.notes = f"{invoice.notes}\nPromo Code Applied: {promo.code} - {promo.description}".strip()
    invoice.save(update_fields=['discount', 'notes'])
    
    # Recalculate totals
    invoice.recalculate_totals()
    invoice.refresh_from_db()
    
    # Increment usage count
    promo.used_count += 1
    promo.save(update_fields=['used_count'])
    
    return Response({
        'success': True,
        'promo_code': promo.code,
        'promo_description': promo.description,
        'discount_amount': str(discount_amount),
        'previous_total': str(previous_total),
        'new_total': str(invoice.total),
        'savings': str(previous_total - invoice.total),
        'message': f'Promo code applied! You saved ${discount_amount}'
    })

@action(detail=True, methods=['post'])
def remove_promo_code(self, request, pk=None):
    """
    Remove promotional code from invoice
    
    Endpoint: POST /api/invoices/{id}/remove-promo-code/
    """
    invoice = self.get_object()
    
    if invoice.discount <= 0:
        return Response({
            'error': 'No discount applied to this invoice'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    previous_total = invoice.total
    previous_discount = invoice.discount
    
    # Remove discount
    invoice.discount = Decimal('0.00')
    invoice.save(update_fields=['discount'])
    
    # Recalculate
    invoice.recalculate_totals()
    invoice.refresh_from_db()
    
    return Response({
        'success': True,
        'discount_removed': str(previous_discount),
        'previous_total': str(previous_total),
        'new_total': str(invoice.total),
        'message': 'Promotional code removed'
    })

@action(detail=False, methods=['post'])
def validate_promo_code(self, request):
    """
    Validate a promo code without applying it
    
    Endpoint: POST /api/invoices/validate-promo-code/
    
    Request body:
    {
        "promo_code": "SUMMER20",
        "subtotal": "100.00"
    }
    """
    code = request.data.get('promo_code')
    subtotal = request.data.get('subtotal')
    
    if not code:
        return Response({
            'error': 'Promo code is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        subtotal = Decimal(str(subtotal)) if subtotal else Decimal('0.00')
    except (ValueError, TypeError):
        return Response({
            'error': 'Invalid subtotal'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        promo = PromotionalCode.objects.get(code=code.upper())
    except PromotionalCode.DoesNotExist:
        return Response({
            'valid': False,
            'error': 'Invalid promotional code'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if valid
    if not promo.is_valid():
        return Response({
            'valid': False,
            'code': promo.code,
            'error': 'This promotional code is not currently valid'
        })
    
    # Check minimum purchase
    if subtotal < promo.min_purchase_amount:
        return Response({
            'valid': False,
            'code': promo.code,
            'error': f'Minimum purchase of ${promo.min_purchase_amount} required',
            'min_purchase': str(promo.min_purchase_amount),
            'current_subtotal': str(subtotal)
        })
    
    # Calculate discount
    discount = promo.apply_discount(subtotal)
    
    return Response({
        'valid': True,
        'code': promo.code,
        'description': promo.description,
        'code_type': promo.code_type,
        'discount_value': str(promo.discount_value),
        'discount_amount': str(discount),
        'estimated_total': str(subtotal - discount),
        'min_purchase': str(promo.min_purchase_amount),
        'usage_remaining': promo.usage_limit - promo.used_count if promo.usage_limit else None
    })


# Add PromotionalCodeViewSet
class PromotionalCodeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing promotional codes
    """
    
    queryset = PromotionalCode.objects.all()
    serializer_class = PromotionalCodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'description']
    ordering = ['-valid_from']
    
    def get_queryset(self):
        """Filter promo codes"""
        queryset = super().get_queryset()
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active == 'true':
            queryset = queryset.filter(is_active=True)
        elif is_active == 'false':
            queryset = queryset.filter(is_active=False)
        
        # Filter by validity
        show_valid_only = self.request.query_params.get('valid_only')
        if show_valid_only == 'true':
            now = timezone.now()
            queryset = queryset.filter(
                is_active=True,
                valid_from__lte=now,
                valid_until__gte=now
            ).filter(
                Q(usage_limit__isnull=True) | Q(used_count__lt=models.F('usage_limit'))
            )
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def active_codes(self, request):
        """
        Get all currently active promo codes
        
        Endpoint: GET /api/promo-codes/active-codes/
        """
        now = timezone.now()
        active_codes = PromotionalCode.objects.filter(
            is_active=True,
            valid_from__lte=now,
            valid_until__gte=now
        ).filter(
            Q(usage_limit__isnull=True) | Q(used_count__lt=models.F('usage_limit'))
        )
        
        serializer = self.get_serializer(active_codes, many=True)
        
        return Response({
            'count': active_codes.count(),
            'codes': serializer.data
        })
```

---

## 6. Testing Instructions

### 6.1 Receipt Generation Tests

**Manual Test:**

1. Create paid invoice
2. Send receipt via email: `POST /api/invoices/{id}/send-receipt/`
3. Check email received
4. Download receipt PDF
5. Verify all invoice details correct
6. Check Receipt table has record

**Automated Test:**

```python
# tests/test_receipts.py
from django.test import TestCase
from pos.utils.receipt_generator import ReceiptGenerator

class ReceiptGenerationTest(TestCase):
    def test_receipt_pdf_generation(self):
        """Test PDF receipt generation"""
        generator = ReceiptGenerator(self.invoice)
        pdf = generator.generate_pdf()
        
        self.assertIsNotNone(pdf)
        self.assertTrue(pdf.getvalue())  # Has content
    
    def test_receipt_email_sending(self):
        """Test email receipt delivery"""
        generator = ReceiptGenerator(self.invoice)
        success, error = generator.send_email('test@example.com')
        
        self.assertTrue(success)
        self.assertIsNone(error)
        
        # Check receipt record created
        receipt = Receipt.objects.filter(invoice=self.invoice).first()
        self.assertIsNotNone(receipt)
        self.assertTrue(receipt.is_sent)
```

### 6.2 Split Payment Tests

**Manual Test:**

1. Create invoice with $100 balance
2. Process split payment:
   - $40 cash
   - $60 card
3. Verify:
   - Both payments created
   - Same split_payment_group
   - Invoice marked as paid
   - Total = $100

**Automated Test:**

```python
# tests/test_split_payments.py
class SplitPaymentTest(TestCase):
    def test_split_payment_processing(self):
        """Test split payment across multiple methods"""
        response = self.client.post(
            f'/api/invoices/{self.invoice.id}/process-split-payment/',
            {
                'payments': [
                    {'amount': '40.00', 'payment_method': self.cash_method.id},
                    {'amount': '60.00', 'payment_method': self.card_method.id}
                ]
            }
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        
        # Verify payments created
        payments = Payment.objects.filter(invoice=self.invoice)
        self.assertEqual(payments.count(), 2)
        
        # Verify same group
        groups = set(p.split_payment_group for p in payments)
        self.assertEqual(len(groups), 1)
```

### 6.3 Tip Handling Tests

**Manual Test:**

1. Process payment with tip
2. Verify tip_amount saved
3. Check tip recipient assigned
4. Run tip report
5. Verify tip totals correct

### 6.4 Gift Card Tests

**Manual Test:**

1. Create gift card ($100)
2. Check balance
3. Use $50 for payment
4. Verify remaining balance = $50
5. Try to use $60 (should fail)

### 6.5 Promo Code Tests

**Manual Test:**

1. Create promo code (20% off)
2. Apply to invoice
3. Verify discount calculated
4. Check usage count incremented
5. Try expired code (should fail)

---

## 7. Deployment Guide

### 7.1 Requirements

Add to `requirements.txt`:

```
weasyprint==60.1
Pillow==10.1.0
```

Install:
```bash
pip install weasyprint Pillow
```

**Note:** WeasyPrint requires system dependencies:
```bash
# Ubuntu/Debian
sudo apt-get install python3-cffi python3-brotli libpango-1.0-0 libpangoft2-1.0-0

# macOS
brew install python pango
```

### 7.2 Settings Configuration

**File:** `settings.py`

```python
# Company Information (for receipts)
COMPANY_NAME = "Your Spa Name"
COMPANY_ADDRESS = "123 Wellness Street, City, State 12345"
COMPANY_PHONE = "(555) 123-4567"
COMPANY_EMAIL = "info@yourspa.com"
COMPANY_WEBSITE = "www.yourspa.com"

# Media files (for receipt PDFs)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Email configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # Or your SMTP server
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'
DEFAULT_FROM_EMAIL = 'your-email@gmail.com'
```

### 7.3 URL Configuration

**File:** `pos/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InvoiceViewSet,
    PaymentViewSet,
    PaymentMethodViewSet,
    GiftCardViewSet,
    PromotionalCodeViewSet,
)

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'payment-methods', PaymentMethodViewSet, basename='paymentmethod')
router.register(r'gift-cards', GiftCardViewSet, basename='giftcard')
router.register(r'promo-codes', PromotionalCodeViewSet, basename='promocode')

urlpatterns = [
    path('', include(router.urls)),
]
```

### 7.4 Migration Steps

```bash
# 1. Create migrations
python manage.py makemigrations

# 2. Review migrations
python manage.py showmigrations pos

# 3. Run migrations (staging first!)
python manage.py migrate

# 4. Create media directory
mkdir -p media/receipts

# 5. Set permissions
chmod 755 media
chmod 755 media/receipts

# 6. Test receipt generation
python manage.py shell
>>> from pos.models import Invoice
>>> from pos.utils.receipt_generator import ReceiptGenerator
>>> invoice = Invoice.objects.first()
>>> generator = ReceiptGenerator(invoice)
>>> pdf = generator.generate_pdf()
>>> print("Success!" if pdf else "Failed")
```

### 7.5 Post-Deployment Checklist

- [ ] Migrations applied successfully
- [ ] Receipt PDF generation works
- [ ] Email sending configured and tested
- [ ] Media directory created with correct permissions
- [ ] Split payments tested
- [ ] Tips recording correctly
- [ ] Gift cards functional
- [ ] Promo codes applying correctly
- [ ] All tests passing

---

## 8. Success Criteria

Phase 2 is complete when:

- [✅] Staff can generate and email receipts
- [✅] Guests can pay with multiple payment methods in one transaction
- [✅] Tips are properly tracked and reported
- [✅] Gift cards can be purchased, activated, and redeemed
- [✅] Promotional codes apply discounts correctly
- [✅] All features tested on staging
- [✅] No critical errors in production
- [✅] Staff trained on new features

---

## 9. API Endpoint Summary

### 9.1 Receipt Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices/{id}/send-receipt/` | Send receipt to guest |
| GET | `/api/invoices/{id}/receipt-history/` | Get receipt history |

### 9.2 Split Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices/{id}/process-split-payment/` | Process split payment |
| GET | `/api/invoices/{id}/split-payments/` | Get split payment groups |

### 9.3 Tip Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices/{id}/process-payment/` | Process payment with tip |
| GET | `/api/invoices/tip-report/` | Get tip report by staff/date |

### 9.4 Gift Card Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gift-cards/` | List all gift cards |
| POST | `/api/gift-cards/` | Create new gift card |
| GET | `/api/gift-cards/{id}/` | Get gift card details |
| GET | `/api/gift-cards/{id}/check-balance/` | Check balance |
| POST | `/api/gift-cards/{id}/use/` | Use for payment |
| POST | `/api/gift-cards/{id}/activate/` | Activate gift card |
| POST | `/api/gift-cards/{id}/deactivate/` | Deactivate gift card |
| POST | `/api/gift-cards/check-by-code/` | Check balance by code |

### 9.5 Promotional Code Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promo-codes/` | List all promo codes |
| POST | `/api/promo-codes/` | Create promo code |
| GET | `/api/promo-codes/active-codes/` | Get active codes |
| POST | `/api/invoices/{id}/apply-promo-code/` | Apply promo to invoice |
| POST | `/api/invoices/{id}/remove-promo-code/` | Remove promo from invoice |
| POST | `/api/invoices/validate-promo-code/` | Validate without applying |

---

## 10. Training Documentation

### 10.1 Receipt Generation Training

**How to Send Receipt via Email:**

1. Open completed invoice
2. Click "Send Receipt" button
3. Verify guest email address
4. Optionally add custom message
5. Click "Send"
6. Guest receives email with PDF attachment

**How to Print Receipt:**

1. Open invoice
2. Click "Send Receipt"
3. Select "Print" as delivery method
4. PDF opens in new tab
5. Use browser print function

### 10.2 Split Payment Training

**Scenario:** Guest wants to pay $50 cash and $58 by card

**Steps:**

1. Open invoice (total = $108)
2. Click "Split Payment" button
3. Add first payment:
   - Method: Cash
   - Amount: $50
4. Add second payment:
   - Method: Credit Card
   - Amount: $58
   - Reference: Last 4 digits
5. Verify total = $108
6. Click "Process Split Payment"
7. Both payments recorded together

**Common Mistakes:**

- ❌ Split amounts don't add up to total
- ❌ Forgetting reference number for card payments
- ✅ Always verify total before processing

### 10.3 Tip Handling Training

**How to Process Payment with Tip:**

1. Calculate service amount (e.g., $100)
2. Ask guest about tip
3. Process payment:
   - Amount: $100 (service only)
   - Tip: $15 (separate field)
   - Total charged: $115
4. Select tip recipient (therapist/staff)
5. Process payment

**Tip Distribution (Multiple Staff):**

Example: $20 tip split between therapist and assistant

1. Process payment for service
2. Add tip distributions:
   - Therapist: $15 (75%)
   - Assistant: $5 (25%)
3. System tracks each staff member's tips

**Tip Reporting:**

- Daily tip totals per staff member
- Monthly tip summaries
- Export for payroll

### 10.4 Gift Card Training

**Selling Gift Card:**

1. Go to Gift Cards section
2. Click "New Gift Card"
3. Enter:
   - Amount: $100
   - Recipient (optional): Guest name
   - Expiry date (optional)
4. System generates unique code (e.g., GC-ABC123DEF45)
5. Print/email gift card to purchaser

**Redeeming Gift Card:**

1. Guest provides gift card code
2. Click "Check Balance" and enter code
3. System shows available balance
4. During payment, select "Gift Card" method
5. Enter code and amount to use
6. System deducts from card balance

**Checking Gift Card Balance:**

- Enter code in "Check Balance" field
- System shows:
  - Original amount
  - Current balance
  - Expiry date
  - Status (active/used/expired)

### 10.5 Promotional Code Training

**Applying Promo Code:**

1. Guest provides promo code
2. Enter code in "Promo Code" field
3. System validates:
   - Code exists and is active
   - Not expired
   - Meets minimum purchase
4. Discount automatically applied
5. New total displayed

**Common Promo Code Types:**

- **Percentage:** 20% off entire purchase
- **Fixed Amount:** $10 off
- **Service Specific:** 50% off massage only

**Validation Errors:**

- "Invalid code" = Code doesn't exist
- "Expired" = Past valid date
- "Minimum $50 required" = Purchase too small
- "Usage limit reached" = Code used up

---

## 11. Troubleshooting Guide

### 11.1 Receipt Generation Issues

**Problem:** PDF not generating

**Solutions:**
```bash
# Check WeasyPrint installed
pip list | grep weasyprint

# Install if missing
pip install weasyprint

# Check system dependencies (Ubuntu)
sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0
```

**Problem:** Email not sending

**Check:**
- Email settings in `settings.py`
- SMTP credentials correct
- Guest email address valid
- Check spam folder

**Problem:** Receipt shows wrong information

**Check:**
- Invoice recalculated correctly
- Template using correct fields
- Company info in settings.py

### 11.2 Split Payment Issues

**Problem:** Split payment rejected

**Common causes:**
- Amounts don't add up to invoice total
- Amount exceeds balance due
- Missing reference for card payment

**Solution:**
```python
# Verify total matches
total_split = sum(payment['amount'] for payment in payments)
assert total_split == invoice.balance_due
```

**Problem:** Payments not grouped together

**Check:**
- All payments have same `split_payment_group`
- `is_split_payment` flag set to True

### 11.3 Tip Issues

**Problem:** Tips not appearing in report

**Check:**
- `tip_amount` field populated
- `tip_recipient` assigned
- Date range includes payment date

**Problem:** Tip distribution doesn't match

**Verify:**
```python
# Tip distributions should sum to tip_amount
distributions = TipDistribution.objects.filter(payment=payment)
total = sum(d.amount for d in distributions)
assert total == payment.tip_amount
```

### 11.4 Gift Card Issues

**Problem:** Gift card shows "used" but has balance

**Check:**
- Status field vs remaining_amount
- Status changes when remaining_amount = 0

**Problem:** Can't use gift card for payment

**Reasons:**
- Status not "active"
- Expired
- Insufficient balance
- Card cancelled

**Solution:**
```python
# Check gift card can be used
can_use = (
    gift_card.status == 'active' and
    not (gift_card.expiry_date and gift_card.expiry_date < timezone.now()) and
    gift_card.remaining_amount > 0
)
```

### 11.5 Promo Code Issues

**Problem:** Valid code not applying

**Check:**
- Invoice meets minimum purchase
- Code applies to invoice services
- Not at usage limit
- Within valid date range

**Problem:** Discount amount wrong

**Verify calculation:**
```python
# Percentage discount
if promo.code_type == 'percentage':
    discount = (invoice.subtotal * promo.discount_value) / 100
    if promo.max_discount_amount:
        discount = min(discount, promo.max_discount_amount)

# Fixed amount
elif promo.code_type == 'fixed_amount':
    discount = min(promo.discount_value, invoice.subtotal)
```

---

## 12. Performance Optimization

### 12.1 Receipt Generation Optimization

**Issue:** Slow PDF generation (>2 seconds)

**Solutions:**

1. **Cache templates:**
```python
from django.template.loader import get_template
from functools import lru_cache

@lru_cache(maxsize=10)
def get_cached_template(template_name):
    return get_template(template_name)
```

2. **Generate async:**
```python
# Use Celery for async generation
from celery import shared_task

@shared_task
def generate_and_send_receipt(invoice_id, recipient_email):
    invoice = Invoice.objects.get(id=invoice_id)
    generator = ReceiptGenerator(invoice)
    generator.send_email(recipient_email)
```

3. **Optimize queries:**
```python
# Prefetch related data
invoice = Invoice.objects.select_related(
    'guest', 'reservation', 'created_by'
).prefetch_related(
    'items', 'items__service', 'payments'
).get(pk=pk)
```

### 12.2 Database Query Optimization

**Before (N+1 queries):**
```python
for payment in invoice.payments.all():
    print(payment.payment_method.name)  # Extra query!
    print(payment.processed_by.username)  # Extra query!
```

**After (Optimized):**
```python
payments = invoice.payments.select_related(
    'payment_method', 'processed_by'
).all()

for payment in payments:
    print(payment.payment_method.name)  # No extra query
    print(payment.processed_by.username)  # No extra query
```

### 12.3 Tip Report Optimization

**Add database index:**
```python
# In migration
migrations.AddIndex(
    model_name='payment',
    index=models.Index(
        fields=['payment_date', 'tip_recipient'],
        name='payment_tip_date_idx'
    ),
)
```

**Optimize aggregation:**
```python
# Use database aggregation instead of Python sum
from django.db.models import Sum, Count

tip_totals = Payment.objects.filter(
    payment_date__range=[start_date, end_date],
    tip_amount__gt=0
).values('tip_recipient__id', 'tip_recipient__username').annotate(
    total_tips=Sum('tip_amount'),
    tip_count=Count('id')
)
```

---

## 13. Security Considerations

### 13.1 Gift Card Security

**Prevent brute force code guessing:**
```python
# Add rate limiting
from django.core.cache import cache

def check_gift_card_rate_limit(ip_address):
    key = f'gift_card_attempts_{ip_address}'
    attempts = cache.get(key, 0)
    
    if attempts > 10:
        raise ValidationError("Too many attempts. Try again in 1 hour.")
    
    cache.set(key, attempts + 1, 3600)  # 1 hour
```

**Generate secure codes:**
```python
import secrets
import string

def generate_secure_gift_card_code():
    """Generate cryptographically secure gift card code"""
    alphabet = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(alphabet) for _ in range(12))
    return f"GC-{code[:4]}-{code[4:8]}-{code[8:]}"
```

### 13.2 Promo Code Security

**Prevent code scraping:**
```python
# Add usage tracking per user/IP
class PromoCodeUsage(models.Model):
    promo_code = models.ForeignKey(PromotionalCode, on_delete=models.CASCADE)
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    ip_address = models.GenericIPAddressField()
    used_at = models.DateTimeField(auto_now_add=True)
```

**Rate limit promo validation:**
```python
# Limit validation attempts
from rest_framework.throttling import UserRateThrottle

class PromoCodeThrottle(UserRateThrottle):
    rate = '10/hour'
```

### 13.3 Receipt Security

**Don't expose sensitive data in receipts:**
```python
# Mask credit card numbers
def mask_card_number(reference):
    if reference and len(reference) >= 4:
        return f"****{reference[-4:]}"
    return reference

# In template
{{ payment.reference|mask_card_number }}
```

**Secure receipt URLs:**
```python
# Add expiring signed URLs
from django.core.signing import TimestampSigner

def generate_receipt_url(receipt_id):
    signer = TimestampSigner()
    token = signer.sign(receipt_id)
    return f"/receipts/download/{token}/"

def verify_receipt_token(token, max_age=3600):
    signer = TimestampSigner()
    try:
        receipt_id = signer.unsign(token, max_age=max_age)
        return receipt_id
    except:
        return None
```

---

## 14. Monitoring & Analytics

### 14.1 Key Metrics to Track

**Receipt Generation:**
- Receipts sent per day
- Email delivery success rate
- PDF generation time
- Failed email attempts

**Split Payments:**
- Number of split payments per day
- Average number of methods per split
- Most common split combinations

**Tips:**
- Average tip percentage
- Total tips per staff member
- Tip trends over time

**Gift Cards:**
- Cards sold per month
- Average card value
- Redemption rate
- Expired card value

**Promo Codes:**
- Most used codes
- Average discount amount
- Conversion rate with/without codes
- Revenue impact

### 14.2 Analytics Queries

**Receipt Analytics:**
```python
from django.db.models import Count, Avg
from django.db.models.functions import TruncDate

# Receipts sent per day
daily_receipts = Receipt.objects.annotate(
    date=TruncDate('sent_at')
).values('date').annotate(
    count=Count('id'),
    success_rate=Count('id', filter=Q(is_sent=True)) * 100.0 / Count('id')
).order_by('-date')
```

**Tip Analytics:**
```python
# Top earners
top_earners = Payment.objects.filter(
    tip_amount__gt=0
).values(
    'tip_recipient__username'
).annotate(
    total_tips=Sum('tip_amount'),
    tip_count=Count('id'),
    avg_tip=Avg('tip_amount')
).order_by('-total_tips')[:10]
```

**Gift Card Analytics:**
```python
# Redemption rate
total_cards = GiftCard.objects.count()
redeemed_cards = GiftCard.objects.filter(status='used').count()
redemption_rate = (redeemed_cards / total_cards * 100) if total_cards > 0 else 0

# Average value
avg_value = GiftCard.objects.aggregate(
    Avg('original_amount')
)['original_amount__avg']
```

**Promo Code Analytics:**
```python
# Most effective codes
promo_effectiveness = PromotionalCode.objects.annotate(
    total_discount=Sum('discount_value') * F('used_count')
).order_by('-used_count')

# Revenue impact
total_discounts = Invoice.objects.aggregate(
    Sum('discount')
)['discount__sum']
```

---

## 15. Future Enhancements (Phase 3 Preview)

After Phase 2 is stable, consider:

1. **Advanced Receipt Features:**
   - QR code for digital receipts
   - Multi-language support
   - Custom branding per location

2. **Split Payment Enhancements:**
   - Save common split patterns
   - Split by percentage
   - Round-up donations

3. **Tip Improvements:**
   - Suggested tip percentages
   - Tip pooling rules
   - Automatic tip distribution

4. **Gift Card Advanced Features:**
   - Reload gift cards
   - Transfer balance between cards
   - Gift card marketplace

5. **Promo Code Improvements:**
   - Auto-apply best discount
   - Stackable codes
   - Referral code tracking
   - A/B testing codes

---

## 16. Support & Resources

### 16.1 Documentation Links

- WeasyPrint Docs: https://weasyprint.org/
- Django Email: https://docs.djangoproject.com/en/stable/topics/email/
- Decimal Handling: https://docs.python.org/3/library/decimal.html

### 16.2 Common Commands

**Generate test receipts:**
```bash
python manage.py shell
>>> from pos.models import Invoice
>>> from pos.utils.receipt_generator import ReceiptGenerator
>>> invoice = Invoice.objects.first()
>>> generator = ReceiptGenerator(invoice)
>>> generator.generate_pdf('test_receipt.pdf')
```

**Check gift card stats:**
```bash
python manage.py shell
>>> from pos.models import GiftCard
>>> GiftCard.objects.aggregate(
...     total_value=Sum('remaining_amount'),
...     active_count=Count('id', filter=Q(status='active'))
... )
```

**Promo code usage report:**
```bash
python manage.py shell
>>> from pos.models import PromotionalCode
>>> for code in PromotionalCode.objects.all():
...     print(f"{code.code}: {code.used_count}/{code.usage_limit or '∞'}")
```

---

## 17. Rollback Plan

If critical issues occur in Phase 2:

### 17.1 Rollback Steps

```bash
# 1. Revert to Phase 1
python manage.py migrate pos 0002_add_critical_fields

# 2. Restore code
git checkout phase1-critical-fixes

# 3. Restart application
systemctl restart gunicorn

# 4. Verify Phase 1 working
# - Process payment (should work)
# - Process refund (should work)
# - Receipts won't work (Phase 2 feature)
```

### 17.2 Partial Rollback

If only one feature broken:

**Disable receipts only:**
```python
# settings.py
FEATURES = {
    'RECEIPTS_ENABLED': False,
    'SPLIT_PAYMENTS_ENABLED': True,
    'TIPS_ENABLED': True,
    'GIFT_CARDS_ENABLED': True,
    'PROMO_CODES_ENABLED': True,
}
```

**Feature flag in views:**
```python
from django.conf import settings

def send_receipt(self, request, pk=None):
    if not settings.FEATURES.get('RECEIPTS_ENABLED', True):
        return Response({
            'error': 'Receipt generation temporarily disabled'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    # ... rest of code
```

---

## 18. Phase 2 Completion Checklist

### 18.1 Development Checklist

- [ ] All migrations created and tested
- [ ] Receipt generation working (PDF + Email)
- [ ] Split payment processing functional
- [ ] Tip tracking and reporting working
- [ ] Gift card full lifecycle working
- [ ] Promo code application working
- [ ] All serializers created
- [ ] All views implemented
- [ ] All tests written and passing
- [ ] Documentation complete

### 18.2 Testing Checklist

- [ ] Receipt PDF generates correctly
- [ ] Receipt email sends successfully
- [ ] Split payment across 2+ methods works
- [ ] Split payment totals validated
- [ ] Tips recorded correctly
- [ ] Tip reports accurate
- [ ] Gift card balance checks work
- [ ] Gift card redemption works
- [ ] Gift card prevents overspending
- [ ] Promo codes validate correctly
- [ ] Promo codes apply discounts
- [ ] Promo code usage limits enforced

### 18.3 Deployment Checklist

- [ ] Staging environment updated
- [ ] All features tested on staging
- [ ] Production backup created
- [ ] Migrations applied to production
- [ ] Static files collected
- [ ] Media directory created
- [ ] Email settings configured
- [ ] WeasyPrint dependencies installed
- [ ] Staff training completed
- [ ] Documentation distributed
- [ ] Monitoring configured
- [ ] 24-hour burn-in period completed

---

## END OF PHASE 2 IMPLEMENTATION GUIDE

**Total Implementation Time:** 1 week (5-7 days)  
**Features Added:** 5 major operational features  
**New Endpoints:** 15+ new API endpoints  
**Testing Time:** 2 days  
**Deployment Time:** 4-6 hours  

**Ready for Phase 3 after:** 1 week of stable Phase 2 operation

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Prerequisites:** Phase 1 completed  
**Next Phase:** Phase 3 - Operational Improvements

---

## Quick Reference Card

### Most Important Endpoints

```
# Receipts
POST /api/invoices/{id}/send-receipt/

# Split Payment
POST /api/invoices/{id}/process-split-payment/

# Tips
POST /api/invoices/{id}/process-payment/  (with tip_amount)
GET /api/invoices/tip-report/

# Gift Cards
POST /api/gift-cards/check-by-code/
POST /api/gift-cards/{id}/use/

# Promo Codes
POST /api/invoices/validate-promo-code/
POST /api/invoices/{id}/apply-promo-code/
```

### Emergency Contacts

- **Receipt Issues:** Check email logs and WeasyPrint installation
- **Payment Issues:** Review Phase 1 critical fixes
- **Database Issues:** Check transaction locks
- **General Support:** [Your support contact]):
        """
        Generate PDF receipt using WeasyPrint
        
        Returns: BytesIO object containing PDF or path to saved file
        """
        if not WEASYPRINT_AVAILABLE:
            raise ImportError("WeasyPrint is required for PDF generation")
        
        html = self.generate_html()
        
        # Create PDF
        pdf_file = BytesIO()
        HTML(string=html, base_url=settings.BASE_DIR).write_pdf(
            pdf_file,
            stylesheets=[CSS(string=self._get_pdf_styles())]
        )
        
        # Save to file if path provided
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(pdf_file.getvalue())
            return save_path
        
        pdf_file.seek(0)
        return pdf_file
    
    def _get_pdf_styles(self):
        """Get CSS styles for PDF"""
        return """
        @page {
            size: A4;
            margin: 1cm;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        
        .company-name {
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .invoice-details {
            margin: 20px 0;
        }
        
        .invoice-details table {
            width: 100%;
        }
        
        .invoice-details td {
            padding: 5px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .items-table th {
            background-color: #f0f0f0;
            padding: 10px;
            text-align: left;
            border-bottom: 2px solid #333;
        }
        
        .items-table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
        }
        
        .totals {
            margin-top: 20px;
            float: right;
            width: 40%;
        }
        
        .totals table {
            width: 100%;
        }
        
        .totals td {
            padding: 5px;
            text-align: right;
        }
        
        .total-row {
            font-weight: bold;
            font-size: 14pt;
            border-top: 2px solid #333;
        }
        
        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 10pt;
            color: #666;
            clear: both;
        }
        
        .payment-info {
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
        }
        """
    
    def send_email(self, recipient_email=None, subject=None, message=None):
        """
        Send receipt via email
        
        Args:
            recipient_email: Email address (defaults to guest email)
            subject: Email subject
            message: Email body message
        
        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        recipient = recipient_email or self.guest.email
        
        if not recipient:
            return False, "No email address provided"
        
        # Generate PDF
        try:
            pdf_file = self.generate_pdf()
        except Exception as e:
            return False, f"PDF generation failed: {str(e)}"
        
        # Create email
        subject = subject or f"Receipt for Invoice {self.invoice.invoice_number}"
        body = message or f"""
Dear {self.guest.first_name} {self.guest.last_name},

Thank you for your visit! Please find your receipt attached.

Invoice Number: {self.invoice.invoice_number}
Total Amount: ${self.invoice.total}
Amount Paid: ${self.invoice.amount_paid}
Balance Due: ${self.invoice.balance_due}

We look forward to serving you again soon!

Best regards,
{getattr(settings, 'COMPANY_NAME', 'Spa & Wellness Center')}
        """.strip()
        
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        
        # Attach PDF
        email.attach(
            f'receipt_{self.invoice.invoice_number}.pdf',
            pdf_file.getvalue(),
            'application/pdf'
        )
        
        # Send email
        try:
            email.send(fail_silently=False)
            return True, None
        except Exception as e:
            return False, str(e)
    
    def send_sms(self, phone_number=None, message=None):
        """
        Send receipt via SMS (with link to download)
        
        Note: Requires SMS service integration (Twilio, etc.)
        """
        # TODO: Implement SMS sending
        # This is a placeholder for future implementation
        return False, "SMS sending not yet implemented"


class RefundReceiptGenerator(ReceiptGenerator):
    """
    Specialized receipt generator for refunds
    """
    
    def __init__(self, invoice, refund):
        super().__init__(invoice)
        self.refund = refund
    
    def generate_context(self):
        """Add refund information to context"""
        context = super().generate_context()
        context['refund'] = self.refund
        context['is_refund'] = True
        return context
    
    def generate_html(self):
        """Generate HTML refund receipt"""
        context = self.generate_context()
        html = render_to_string('receipts/refund_receipt.html', context)
        return html
```

### 1.4 Receipt HTML Templates

**File:** `pos/templates/receipts/invoice_receipt.html` (NEW FILE)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - {{ invoice.invoice_number }}</title>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ company_name }}</div>
        <div>{{ company_address }}</div>
        <div>Phone: {{ company_phone }} | Email: {{ company_email }}</div>
        {% if company_website %}
        <div>{{ company_website }}</div>
        {% endif %}
    </div>
    
    <div class="invoice-details">
        <table>
            <tr>
                <td><strong>Receipt #:</strong></td>
                <td>{{ invoice.receipt_number|default:invoice.invoice_number }}</td>
                <td><strong>Date:</strong></td>
                <td>{{ invoice.date|date:"F d, Y" }}</td>
            </tr>
            <tr>
                <td><strong>Invoice #:</strong></td>
                <td>{{ invoice.invoice_number }}</td>
                <td><strong>Time:</strong></td>
                <td>{{ invoice.date|date:"g:i A" }}</td>
            </tr>
        </table>
        
        <h3>Guest Information</h3>
        <table>
            <tr>
                <td><strong>Name:</strong></td>
                <td>{{ guest.first_name }} {{ guest.last_name }}</td>
            </tr>
            <tr>
                <td><strong>Email:</strong></td>
                <td>{{ guest.email }}</td>
            </tr>
            <tr>
                <td><strong>Phone:</strong></td>
                <td>{{ guest.phone }}</td>
            </tr>
        </table>
    </div>
    
    <h3>Services & Products</h3>
    <table class="items-table">
        <thead>
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax Rate</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            {% for item in items %}
            <tr>
                <td>{{ item.product_name }}</td>
                <td>{{ item.quantity }}</td>
                <td>${{ item.unit_price }}</td>
                <td>{{ item.tax_rate }}%</td>
                <td>${{ item.line_total }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td>${{ invoice.subtotal }}</td>
            </tr>
            {% if invoice.service_charge > 0 %}
            <tr>
                <td>Service Charge ({{ service_charge_rate }}%):</td>
                <td>${{ invoice.service_charge }}</td>
            </tr>
            {% endif %}
            <tr>
                <td>Tax ({{ vat_rate }}%):</td>
                <td>${{ invoice.tax }}</td>
            </tr>
            {% if invoice.discount > 0 %}
            <tr>
                <td>Discount:</td>
                <td>-${{ invoice.discount }}</td>
            </tr>
            {% endif %}
            <tr class="total-row">
                <td>Total:</td>
                <td>${{ invoice.total }}</td>
            </tr>
        </table>
    </div>
    
    <div style="clear: both;"></div>
    
    {% if payments %}
    <div class="payment-info">
        <h3>Payment Information</h3>
        <table class="items-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                </tr>
            </thead>
            <tbody>
                {% for payment in payments %}
                <tr>
                    <td>{{ payment.payment_date|date:"M d, Y g:i A" }}</td>
                    <td>{{ payment.get_method_display }}</td>
                    <td>${{ payment.amount }}</td>
                    <td>{{ payment.reference|default:"-" }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        
        <div class="totals">
            <table>
                <tr>
                    <td>Amount Paid:</td>
                    <td>${{ invoice.amount_paid }}</td>
                </tr>
                {% if invoice.balance_due > 0 %}
                <tr>
                    <td><strong>Balance Due:</strong></td>
                    <td><strong>${{ invoice.balance_due }}</strong></td>
                </tr>
                {% else %}
                <tr>
                    <td colspan="2" style="color: green; text-align: center;">
                        <strong>PAID IN FULL</strong>
                    </td>
                </tr>
                {% endif %}
            </table>
        </div>
    </div>
    {% endif %}
    
    <div class="footer">
        <p>Thank you for your business!</p>
        <p>{{ company_name }} - {{ company_phone }}</p>
        {% if invoice.notes %}
        <p style="margin-top: 20px; font-style: italic;">{{ invoice.notes }}</p>
        {% endif %}
    </div>
</body>
</html>
```

**File:** `pos/templates/receipts/refund_receipt.html` (NEW FILE)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refund Receipt - {{ invoice.invoice_number }}</title>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ company_name }}</div>
        <div style="color: red; font-size: 18pt; margin-top: 10px;">REFUND RECEIPT</div>
        <div>{{ company_address }}</div>
        <div>Phone: {{ company_phone }} | Email: {{ company_email }}</div>
    </div>
    
    <div class="invoice-details">
        <table>
            <tr>
                <td><strong>Refund Receipt #:</strong></td>
                <td>REF-{{ refund.id }}</td>
                <td><strong>Date:</strong></td>
                <td>{{ refund.processed_at|date:"F d, Y g:i A" }}</td>
            </tr>
            <tr>
                <td><strong>Original Invoice #:</strong></td>
                <td>{{ invoice.invoice_number }}</td>
                <td><strong>Refund Amount:</strong></td>
                <td style="color: red; font-weight: bold;">${{ refund.amount }}</td>
            </tr>
        </table>
        
        <h3>Guest Information</h3>
        <table>
            <tr>
                <td><strong>Name:</strong></td>
                <td>{{ guest.first_name }} {{ guest.last_name }}</td>
            </tr>
            <tr>
                <td><strong>Email:</strong></td>
                <td>{{ guest.email }}</td>
            </tr>
        </table>
    </div>
    
    <div class="payment-info">
        <h3>Refund Details</h3>
        <table>
            <tr>
                <td><strong>Refund Reason:</strong></td>
                <td>{{ refund.reason }}</td>
            </tr>
            <tr>
                <td><strong>Refund Method:</strong></td>
                <td>{{ refund.payment.method|default:"Original Payment Method" }}</td>
            </tr>
            <tr>
                <td><strong>Processed By:</strong></td>
                <td>{{ refund.approved_by.get_full_name|default:"System" }}</td>
            </tr>
        </table>
        
        <h3>Original Invoice Summary</h3>
        <div class="totals">
            <table>
                <tr>
                    <td>Original Total:</td>
                    <td>${{ invoice.total }}</td>
                </tr>
                <tr>
                    <td>Previous Amount Paid:</td>
                    <td>${{ invoice.amount_paid|add:refund.amount }}</td>
                </tr>
                <tr style="color: red;">
                    <td>Refunded:</td>
                    <td>-${{ refund.amount }}</td>
                </tr>
                <tr class="total-row">
                    <td>Remaining Paid:</td>
                    <td>${{ invoice.amount_paid }}</td>
                </tr>
                <tr>
                    <td>Current Balance Due:</td>
                    <td>${{ invoice.balance_due }}</td>
                </tr>
            </table>
        </div>
    </div>
    
    <div style="clear: both;"></div>
    
    <div class="footer">
        <p>This refund has been processed and will appear in your account within 5-10 business days.</p>
        <p>For questions, please contact us at {{ company_phone }} or {{ company_email }}</p>
        <p>{{ company_name }}</p>
    </div>
</body>
</html>
```

### 1.5 Serializers Update

**File:** `pos/serializers.py` (Add ReceiptSerializer)

```python
class ReceiptSerializer(serializers.ModelSerializer):
    """Serializer for Receipt model"""
    
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    guest_name = serializers.SerializerMethodField()
    sent_by_name = serializers.SerializerMethodField()
    receipt_type_display = serializers.CharField(source='get_receipt_type_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    
    class Meta:
        model = Receipt
        fields = [
            'id',
            'receipt_number',
            'invoice',
            'invoice_number',
            'guest_name',
            'receipt_type',
            'receipt_type_display',
            'delivery_method',
            'delivery_method_display',
            'recipient_email',
            'recipient_phone',
            'file_path',
            'sent_at',
            'sent_by',
            'sent_by_name',
            'is_sent',
            'send_error',
        ]
        read_only_fields = [
            'id',
            'receipt_number',
            'sent_at',
            'invoice_number',
            'guest_name',
            'sent_by_name',
            'receipt_type_display',
            'delivery_method_display',
        ]
    
    def get_guest_name(self, obj):
        if obj.invoice and obj.invoice.guest:
            return f"{obj.invoice.guest.first_name} {obj.invoice.guest.last_name}"
        return None
    
    def get_sent_by_name(self, obj):
        if obj.sent_by:
            return obj.sent_by.get_full_name() or obj.sent_by.username
        return None


class SendReceiptSerializer(serializers.Serializer):
    """Serializer for sending receipt"""
    
    delivery_method = serializers.ChoiceField(
        choices=['email', 'print', 'sms', 'download'],
        default='email'
    )
    
    recipient_email = serializers.EmailField(
        required=False,
        allow_blank=True,
        help_text="Email address (defaults to guest email)"
    )
    
    recipient_phone = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        help_text="Phone number for SMS"
    )
    
    subject = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        help_text="Email subject (for email delivery)"
    )
    
    message = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Custom message"
    )
    
    receipt_type = serializers.ChoiceField(
        choices=['payment', 'refund', 'invoice'],
        default='payment'
    )
```

### 1.6 Views Update

**File:** `pos/views.py` (Update InvoiceViewSet)

```python
from pos.utils.receipt_generator import ReceiptGenerator, RefundReceiptGenerator

class InvoiceViewSet(viewsets.ModelViewSet):
    # ... existing code ...
    
    @action(detail=True, methods=['post'])
    def send_receipt(self, request, pk=None):
        """
        Generate and send receipt to guest
        
        Endpoint: POST /api/invoices/{id}/send-receipt/
        
        Request body:
        {
            "delivery_method": "email",
            "recipient_email": "guest@example.com",
            "subject": "Your Receipt",
            "message": "Thank you for your visit!"
        }
        """
        invoice = self.get_object()
        
        # Validate request
        serializer = SendReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        delivery_method = serializer.validated_data['delivery_method']
        recipient_email = serializer.validated_data.get('recipient_email')
        recipient_phone = serializer.validated_data.get('recipient_phone')
        subject = serializer.validated_data.get('subject')
        message = serializer.validated_data.get('message')
        receipt_type = serializer.validated_data.get('receipt_type', 'payment')
        
        # Generate receipt number if needed
        if not invoice.receipt_number:
            invoice.receipt_number = Receipt.generate_receipt_number(invoice)
            invoice.save(update_fields=['receipt_number'])
        
        # Create receipt generator
        generator = ReceiptGenerator(invoice)
        
        # Process based on delivery method
        try:
            if delivery_method == 'email':
                success, error = generator.send_email(
                    recipient_email=recipient_email,
                    subject=subject,
                    message=message
                )
                
                if success:
                    # Create receipt record
                    receipt = Receipt.objects.create(
                        invoice=invoice,
                        receipt_number=invoice.receipt_number,
                        receipt_type=receipt_type,
                        delivery_method='email',
                        recipient_email=recipient_email or invoice.guest.email,
                        sent_by=request.user,
                        is_sent=True
                    )
                    
                    # Update invoice
                    invoice.receipt_sent_at = timezone.now()
                    invoice.receipt_sent_to = recipient_email or invoice.guest.email
                    invoice.save(update_fields=['receipt_sent_at', 'receipt_sent_to'])
                    
                    return Response({
                        'success': True,
                        'receipt_id': receipt.id,
                        'sent_to': receipt.recipient_email,
                        'message': 'Receipt sent successfully via email'
                    })
                else:
                    # Create failed receipt record
                    receipt = Receipt.objects.create(
                        invoice=invoice,
                        receipt_number=invoice.receipt_number,
                        receipt_type=receipt_type,
                        delivery_method='email',
                        recipient_email=recipient_email or invoice.guest.email,
                        sent_by=request.user,
                        is_sent=False,
                        send_error=error
                    )
                    
                    return Response({
                        'success': False,
                        'error': error,
                        'receipt_id': receipt.id
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            elif delivery_method == 'download':
                # Generate PDF and return download URL
                media_root = settings.MEDIA_ROOT
                file_name = f'receipts/receipt_{invoice.invoice_number}.pdf'
                file_path = os.path.join(media_root, file_name)
                
                generator.generate_pdf(save_path=file_path)
                
                # Create receipt record
                receipt = Receipt.objects.create(
                    invoice=invoice,
                    receipt_number=invoice.receipt_number,
                    receipt_type=receipt_type,
                    delivery_method='download',
                    file_path=file_name,
                    sent_by=request.user,
                    is_sent=True
                )
                
                download_url = f"{settings.MEDIA_URL}{file_name}"
                
                return Response({
                    'success': True,
                    'receipt_id': receipt.id,
                    'download_url': download_url,
                    'message': 'Receipt generated successfully'
                })
            
            elif delivery_method == 'print':
                # Generate PDF for printing
                pdf_file = generator.generate_pdf()
                
                # Create receipt record
                receipt = Receipt.objects.create(
                    invoice=invoice,
                    receipt_number=invoice.receipt_number,
                    receipt_type=receipt_type,
                    delivery_method='print',
                    sent_by=request.user,
                    is_sent=True
                )
                
                # Return PDF as response
                from django.http import HttpResponse
                response = HttpResponse(pdf_file.getvalue(), content_type='application/pdf')
                response['Content-Disposition'] = f'inline; filename="receipt_{invoice.invoice_number}.pdf"'
                return response
            
            elif delivery_method == 'sms':
                success, error = generator.send_sms(
                    phone_number=recipient_phone,
                    message=message
                )
                
                if success:
                    receipt = Receipt.objects.create(
                        invoice=invoice,
                        receipt_number=invoice.receipt_number,
                        receipt_type=receipt_type,
                        delivery_method='sms',
                        recipient_phone=recipient_phone or invoice.guest.phone,
                        sent_by=request.user,
                        is_sent=True
                    )
                    
                    return Response({
                        'success': True,
                        'receipt_id': receipt.id,
                        'sent_to': receipt.recipient_phone,
                        'message': 'Receipt sent successfully via SMS'
                    })
                else:
                    return Response({
                        'success': False,
                        'error': error
                    }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def receipt_history(self, request, pk=None):
        """
        Get all receipts sent for this invoice
        
        Endpoint: GET /api/invoices/{id}/receipt-history/
        """
        invoice = self.get_object()
        receipts = invoice.receipts.all()
        serializer = ReceiptSerializer(receipts, many=True)
        
        return Response({
            'invoice_number': invoice.invoice_number,
            'total_receipts': receipts.count(),
            'receipts': serializer.data
        })
```

---

## 2. Split Payment Support

### 2.1 Database Migration

**File:** `pos/migrations/0004_split_payments.py`

```python
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0003_receipt_fields'),
    ]

    operations = [
        # Add split payment tracking
        migrations.AddField(
            model_name='payment',
            name='split_payment_group',
            field=models.CharField(
                max_length=50,
                blank=True,
                db_index=True,
                help_text='Group ID for split payments'
            ),
        ),
        
        migrations.AddField(
            model_name='payment',
            name='is_split_payment',
            field=models.BooleanField(
                default=False,
                help_text='Whether this is part of a split payment'
            ),
        ),
        
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(
                fields=['split_payment_group'],
                name='payment_split_group_idx'
            ),
        ),
    ]
```

### 2.2 Models Update

**File:** `pos/models.py` (Update Payment model)

```python
class Payment(models.Model):
    # ... existing fields ...
    
    # NEW: Split payment fields
    split_payment_group = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text='Group ID for split payments'
    )
    
    is_split_payment = models.BooleanField(
        default=False,
        help_text='Whether this is part of a split payment'
    )
    
    # ... rest of existing fields ...
    
    @staticmethod
    def generate_split_payment_group():
        """Generate unique split payment group ID"""
        import uuid
        return f"SPLIT-{uuid.uuid4().hex[:12].upper()}"
```

### 2.3 Serializers Update

**File:** `pos/serializers.py`

```python
class SplitPaymentSerializer(serializers.Serializer):
    """
    Serializer for processing split payments
    
    Example:
    {
        "payments": [
            {
                "amount": "50.00",
                "payment_method": 1,
                "reference": "CASH"
            },
            {
                "amount": "58.00",
                "payment_method": 2,
                "reference": "VISA-1234"
            }
        ],
        "notes": "Split payment: Cash + Card"
    }
    """
    
    payments = serializers.ListField(
        child=serializers.DictField(),
        min_length=2,
        help_text="List of payment objects"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Notes about split payment"
    )
    
    def validate_payments(self, value):
        """Validate each payment in the list"""
        validated_payments = []
        
        for payment_data in value:
            # Validate required fields
            if 'amount' not in payment_data:
                raise serializers.ValidationError("Each payment must have an 'amount'")
            if 'payment_method' not in payment_data:
                raise serializers.ValidationError("Each payment must have a 'payment_method'")
            
            # Validate amount
            try:
                amount = Decimal(str(payment_data['amount']))
                if amount <= 0:
                    raise serializers.ValidationError("Payment amount must be positive")
            except (ValueError, TypeError):
                raise serializers.ValidationError("Invalid amount format")
            
            # Validate payment method exists
            try:
                payment_method = PaymentMethod.objects.get(
                    id=payment_data['payment_method'],
                    is_active=True
                )
            except PaymentMethod.DoesNotExist:
                raise serializers.ValidationError(
                    f"Invalid payment method: {payment_data['payment_method']}"
                )
            
            # Check if reference required
            if payment_method.requires_reference and not payment_data.get('reference'):
                raise serializers.ValidationError(
                    f"{payment_method.name} requires a reference number"
                )
            
            validated_payments.append({
                'amount': amount,
                'payment_method': payment_method,
                'payment_type': payment_data.get('payment_type', 'partial'),
                'reference': payment_data.get('reference', ''),
                'transaction_id': payment_data.get('transaction_id', ''),
            })
        
        return validated_payments
    
    def validate(self, data):
        """Validate total amount matches invoice balance"""
        # Note: Invoice validation happens in view
        return data
```

### 2.4 Views Update

**File:** `pos/views.py` (Add to InvoiceViewSet)

```python
@action(detail=True, methods=['post'])
def process_split_payment(self, request, pk=None):
    """
    Process multiple payments at once (split payment)
    
    Endpoint: POST /api/invoices/{id}/process-split-payment/
    
    Request body:
    {
        "payments": [
            {
                "amount": "50.00",
                "payment_method": 1,
                "reference": "CASH"
            },
            {
                "amount": "58.00",
                "payment_method": 2,
                "reference": "VISA-1234"
            }
        ],
        "notes": "Guest paid with cash and card"
    }
    """
    
    # Validate request
    serializer = SplitPaymentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    payments_data = serializer.validated_data['payments']
    notes = serializer.validated_data.get('notes', '')
    
    # Calculate total amount
    total_amount = sum(p['amount'] for p in payments_data)
    
    try:
        with transaction.atomic():
            # Lock invoice
            invoice = Invoice.objects.select_for_update().get(pk=pk)
            
            # Validate invoice can accept payments
            if not invoice.can_be_paid():
                return Response({
                    'error': f'Cannot process payment for {invoice.status} invoice',
                    'invoice_status': invoice.status
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate total amount doesn't exceed balance
            if total_amount > invoice.balance_due:
                return Response({
                    'error': f'Total payment amount ${total_amount} exceeds balance due ${invoice.balance_due}',
                    'total_amount': str(total_amount),
                    'balance_due': str(invoice.balance_due)
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate split payment group ID
            split_group = Payment.generate_split_payment_group()
            
            # Create all payments
            created_payments = []
            for payment_data in payments_data:
                payment = Payment.objects.create(
                    invoice=invoice,
                    method=payment_data['payment_method'].code,
                    payment_method=payment_data['payment_method'],
                    payment_type=payment_data['payment_type'],
                    amount=payment_data['amount'],
                    reference=payment_data['reference'],
                    transaction_id=payment_data['transaction_id'],
                    status='completed',
                    notes=f"Split Payment Group: {split_group}\n{notes}".strip(),
                    processed_by=request.user,
                    is_split_payment=True,
                    split_payment_group=split_group
                )
                created_payments.append(payment)
            
            # Refresh invoice to get updated totals
            invoice.refresh_from_db()
    
    except Exception as e:
        return Response({
            'error': f'Split payment processing failed: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Prepare response
    payment_details = []
    for payment in created_payments:
        payment_details.append({
            'payment_id': payment.id,
            'amount': str(payment.amount),
            'method': payment.payment_method.name,
            'reference': payment.reference
        })
    
    return Response({
        'success': True,
        'split_payment_group': split_group,
        'total_amount': str(total_amount),
        'payment_count': len(created_payments),
        'payments': payment_details,
        'invoice_total': str(invoice.total),
        'total_paid': str(invoice.amount_paid),
        'balance_due': str(invoice.balance_due),
        'invoice_status': invoice.status,
        'message': f'Split payment of ${total_amount} processed successfully ({len(created_payments)} payments)'
    })

@action(detail=True, methods=['get'])
def split_payments(self, request, pk=None):
    """
    Get all split payment groups for this invoice
    
    Endpoint: GET /api/invoices/{id}/split-payments/
    """
    invoice = self.get_object()
    
    # Get all split payments
    split_payments = invoice.payments.filter(
        is_split_payment=True
    ).order_by('split_payment_group', 'payment_date')
    
    # Group by split_payment_group
    grouped = {}
    for payment in split_payments:
        group = payment.split_payment_group
        if group not in grouped:
            grouped[group] = {
                'split_payment_group': group,
                'payment_date': payment.payment_date,
                'total_amount': Decimal('0.00'),
                'payments': []
            }
        
        grouped[group]['total_amount'] += payment.amount
        grouped[group]['payments'].append(PaymentSerializer(payment).data)
    
    return Response({
        'invoice_number': invoice.invoice_number,
        'split_payment_groups': list(grouped.values())
    })
```

---

## 3. Tip/Gratuity Handling

### 3.1 Database Migration

**File:** `pos/migrations/0005_tip_fields.py`

```python
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0004_split_payments'),
        ('accounts', '0001_initial'),  # Adjust based on your accounts app
    ]

    operations = [
        # Add tip fields to Payment
        migrations.AddField(
            model_name='payment',
            name='tip_amount',
            field=models.DecimalField(
                max_digits=10,
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Tip/gratuity amount'
            ),
        ),
        
        migrations.AddField(
            model_name='payment',
            name='tip_recipient',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='tips_received',
                to='accounts.user',
                help_text='Staff member who received the tip'
            ),
        ),
        
        # Create TipDistribution model for multiple staff tips
        migrations.CreateModel(
            name='TipDistribution',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('payment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tip_distributions',
                    to='pos.payment'
                )),
                ('recipient', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tip_distributions',
                    to='accounts.user'
                )),
                ('amount', models.DecimalField(
                    max_digits=10,
                    decimal_places=2,
                    help_text='Tip amount for this recipient'
                )),
                ('percentage', models.DecimalField(
                    max_digits=5,
                    decimal_places=2,
                    null=True,
                    blank=True,
                    help_text='Percentage of total tip'
                )),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'verbose_name': 'Tip Distribution',
                'verbose_name_plural': 'Tip Distributions',
            },
        ),
    ]
```

### 3.2 Models Update

**File:** `pos/models.py`

```python
class Payment(models.Model):
    # ... existing fields ...
    
    # NEW: Tip fields
    tip_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Tip/gratuity amount'
    )
    
    tip_recipient = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tips_received',
        help_text='Staff member who received the tip'
    )
    
    # ... rest of existing fields ...
    
    def get_total_with_tip(self):
        """Get total payment amount including tip"""
        return self.amount + self.tip_amount


class TipDistribution(models.Model):
    """
    Track tip distribution among multiple staff members
    
    Use case: Guest tips $20, split between therapist ($15) and assistant ($5)
    """
    
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='tip_distributions'
    )
    
    recipient = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='tip_distributions'
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Tip amount for this recipient'
    )
    
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage of total tip'
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Tip Distribution'
        verbose_name_plural = 'Tip Distributions'
    
    def __str__(self):
        return f"Tip ${self.amount} to {self.recipient.get_full_name()}"
```

### 3.3 Serializers Update

**File:** `pos/serializers.py`

```python
class TipDistributionSerializer(serializers.ModelSerializer):
    """Serializer for tip distributions"""
    
    recipient_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TipDistribution
        fields = [
            'id',
            'recipient',
            'recipient_name',
            'amount',
            'percentage',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'recipient_name', 'created_at']
    
    def get_recipient_name(self, obj):
        return obj.recipient.get_full_name() or obj.recipient.username


class ProcessPaymentWithTipSerializer(ProcessPaymentSerializer):
    """Extended payment serializer with tip support"""
    
    tip_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=Decimal('0.00'),
        min_value=Decimal('0.00'),
        help_text='Tip/gratuity amount'
    )
    
    tip_recipient = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Staff member ID who receives the tip'
    )
    
    tip_distributions = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='Split tip among multiple staff (alternative to tip_recipient)'
    )
    
    def validate_tip_recipient(self, value):
        """Validate tip recipient exists"""
        if value:
            from accounts.models import User
            try:
                return User.objects.get(id=value)
            except User.DoesNotExist:
                raise serializers.ValidationError("Invalid staff member")
        return None
    
    def validate_tip_distributions(self, value):
        """Validate tip distributions"""
        if not value:
            return []
        
        from accounts.models import User
        validated = []
        total_percentage = Decimal('0.00')
        
        for dist in value:
            if 'recipient' not in dist or 'amount' not in dist:
                raise serializers.ValidationError(
                    "Each distribution must have 'recipient' and 'amount'"
                )
            
            try:
                recipient = User.objects.get(id=dist['recipient'])
            except User.DoesNotExist:
                raise serializers.ValidationError(f"Invalid recipient: {dist['recipient']}")
            
            amount = Decimal(str(dist['amount']))
            if amount < 0:
                raise serializers.ValidationError("Tip amount cannot be negative")
            
            percentage = Decimal(str(dist.get('percentage', 0)))
            if percentage:
                total_percentage += percentage
            
            validated.append({
                'recipient': recipient,
                'amount': amount,
                'percentage': percentage if percentage else None,
                'notes': dist.get('notes', '')
            })
        
        # Validate percentages add up to 100 if provided
        if total_percentage > 0 and abs(total_percentage - Decimal('100.00')) > Decimal('0.01'):
            raise serializers.ValidationError(
                f"Tip percentages must add up to 100% (got {total_percentage}%)"
            )
        
        return validated
    
    def validate(self, data):
        """Cross-field validation"""
        data = super().validate(data)
        
        tip_amount = data.get('tip_amount', Decimal('0.00'))
        tip_recipient = data.get('tip_recipient')
        tip_distributions = data.get('tip_distributions', [])
        
        # Can't have both tip_recipient and tip_distributions
        if tip_recipient and tip_distributions:
            raise serializers.ValidationError(
                "Cannot specify both 'tip_recipient' and 'tip_distributions'"
            )
        
        # If distributions provided, validate total matches tip_amount
        if tip_distributions:
            total_distributed = sum(d['amount'] for d in tip_distributions)
            if abs(total_distributed - tip_amount) > Decimal('0.01'):
                raise serializers.ValidationError(
                    f"Tip distributions (${total_distributed}) must equal tip_amount (${tip_amount})"
                )
        
        return data
```

### 3.4 Views Update

**File:** `pos/views.py` (Update process_payment)

```python
@action(detail=True, methods=['post'])
def process_payment(self, request, pk=None):
    """
    Process a payment for this invoice (now with tip support)
    
    Request body:
    {
        "amount": "100.00",
        "payment_method": 2,
        "tip_amount": "15.00",
        "tip_recipient": 5,
        // OR for split tips:
        "tip_distributions": [
            {"recipient": 5, "amount": "10.00", "percentage": "66.67"},
            {"recipient": 6, "amount": "5.00", "percentage": "33.33"}
        ]
    }
    """
    
    # Use extended serializer with tip support
    serializer = ProcessPaymentWithTipSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    amount = serializer.validated_data['amount']
    payment_method = serializer.validated_data['payment_method']
    payment_type = serializer.validated_data['payment_type']
    reference = serializer.validated_data.get('reference', '')
    transaction_id = serializer.validated_data.get('transaction_id', '')
    notes = serializer.validated_data.get('notes', '')
    idempotency_key = serializer.validated_data.get('idempotency_key', '')
    
    # NEW: Tip fields
    tip_amount = serializer.validated_data.get('tip_amount', Decimal('0.00'))
    tip_recipient = serializer.validated_data.get('tip_recipient')
    tip_distributions = serializer.validated_data.get('tip_distributions', [])
    
    # Check for duplicate payment
    if idempotency_key:
        existing_payment = Payment.objects.filter(
            idempotency_key=idempotency_key
        ).first()
        
        if existing_payment:
            return Response({
                'success': True,
                'duplicate': True,
                'payment_id': existing_payment.id,
                'amount_paid': str(existing_payment.amount),
                'tip_amount': str(existing_payment.tip_amount),
                'message': 'Payment already processed (idempotency key matched)'
            })
    
    try:
        with transaction.atomic():
            # Lock invoice
            invoice = Invoice.objects.select_for_update().get(pk=pk)
            
            # Validate invoice
            if not invoice.can_be_paid():
                return Response({
                    'error': f'Cannot process payment for {invoice.status} invoice'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if amount > invoice.balance_due:
                return Response({
                    'error': f'Payment amount ${amount} exceeds balance due ${invoice.balance_due}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create payment
            payment = Payment.objects.create(
                invoice=invoice,
                method=payment_method.code,
                payment_method=payment_method,
                payment_type=payment_type,
                amount=amount,
                transaction_id=transaction_id,
                reference=reference,
                status='completed',
                notes=notes,
                processed_by=request.user,
                idempotency_key=idempotency_key or None,
                tip_amount=tip_amount,
                tip_recipient=tip_recipient
            )
            
            # Create tip distributions if provided
            if tip_distributions:
                for dist in tip_distributions:
                    TipDistribution.objects.create(
                        payment=payment,
                        recipient=dist['recipient'],
                        amount=dist['amount'],
                        percentage=dist.get('percentage'),
                        notes=dist.get('notes', '')
                    )
            
            invoice.refresh_from_db()
    
    except Exception as e:
        return Response({
            'error': f'Payment processing failed: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    return Response({
        'success': True,
        'payment_id': payment.id,
        'amount_paid': str(payment.amount),
        'tip_amount': str(payment.tip_amount),
        'total_with_tip': str(payment.get_total_with_tip()),
        'invoice_total': str(invoice.total),
        'total_paid': str(invoice.amount_paid),
        'balance_due': str(invoice.balance_due),
        'invoice_status': invoice.status,
        'tip_recipient': tip_recipient.get_full_name() if tip_recipient else None,
        'message': f'Payment of ${payment.amount} processed successfully'
    })


# NEW: Tip reporting endpoints
@action(detail=False, methods=['get'])
def tip_report(self, request):
    """
    Get tip report by staff member and date range
    
    Endpoint: GET /api/invoices/tip-report/?start_date=2025-01-01&end_date=2025-01-31&staff=5
    """
    from django.db.models import Sum, Count, Avg
    from accounts.models import User
    
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    staff_id = request.query_params.get('staff')
    
    # Base queryset
    payments = Payment.objects.filter(
        status='completed',
        tip_amount__gt=0
    )
    
    # Apply filters
    if start_date:
        payments = payments.filter(payment_date__gte=start_date)
    if end_date:
        payments = payments.filter(payment_date__lte=end_date)
    if staff_id:
        payments = payments.filter(tip_recipient_id=staff_id)
    
    # Calculate totals
    summary = payments.aggregate(
        total_tips=Sum('tip_amount'),
        tip_count=Count('id'),
        average_tip=Avg('tip_amount')
    )
    
    # Group by staff member
    staff_tips = {}
    for payment in payments.select_related('tip_recipient'):
        if payment.tip_recipient:
            staff_name = payment.tip_recipient.get_full_name()
            if staff_name not in staff_tips:
                staff_tips[staff_name] = {
                    'staff_id': payment.tip_recipient.id,
                    'staff_name': staff_name,
                    'total_tips': Decimal('0.00'),
                    'tip_count': 0,
                    'average_tip': Decimal('0.00')
                }
            
            staff_tips[staff_name]['total_tips'] += payment.tip_amount
            staff_tips[staff_name]['tip_count'] += 1
    
    # Calculate averages
    for staff_data in staff_tips.values():
        if staff_data['tip_count'] > 0:
            staff_data['average_tip'] = staff_data['total_tips'] / staff_data['tip_count']
        staff_data['total_tips'] = str(staff_data['total_tips'])
        staff_data['average_tip'] = str(staff_data['average_tip'])
    
    return Response({
        'summary': {
            'total_tips': str(summary['total_tips'] or Decimal('0.00')),
            'tip_count': summary['tip_count'] or 0,
            'average_tip': str(summary['average_tip'] or Decimal('0.00'))
        },
        'by_staff': list(staff_tips.values())
    })
```

---

## 4. Gift Card Integration

### 4.1 Views for Gift Card

**File:** `pos/views.py` (Add GiftCardViewSet)

```python
class GiftCardViewSet(viewsets.ModelViewSet):
    """
    ViewSet for gift card management
    """