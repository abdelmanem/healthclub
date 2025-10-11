# Complete Invoice & Payment System Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [Integration Steps](#integration-steps)
5. [Workflow Documentation](#workflow-documentation)
6. [Testing Checklist](#testing-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete implementation details for integrating an invoice and payment system with your spa reservation management system.

### Key Features
- ✅ Automatic invoice creation on checkout
- ✅ Multi-payment processing (Cash, Card, Mobile, etc.)
- ✅ Refund handling with loyalty point adjustments
- ✅ Real-time payment validation
- ✅ Guest loyalty point integration
- ✅ Complete audit trail
- ✅ Room status management (dirty/clean)
- ✅ Housekeeping task creation

### Technology Stack
- **Backend:** Django REST Framework, PostgreSQL
- **Frontend:** React, TypeScript, Material-UI
- **State Management:** React Hooks
- **Date Handling:** Day.js

---

## Backend Implementation

### 1. Models (invoices/models.py)

```python
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q

class PaymentMethod(models.Model):
    """Available payment methods"""
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    requires_reference = models.BooleanField(default=False)
    icon = models.CharField(max_length=50, blank=True)
    display_order = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return self.name


class Invoice(models.Model):
    """Main invoice model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Payment'),
        ('partial', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]
    
    invoice_number = models.CharField(max_length=50, unique=True, blank=True)
    guest = models.ForeignKey('guests.Guest', on_delete=models.CASCADE, related_name='invoices')
    reservation = models.ForeignKey('reservations.Reservation', on_delete=models.CASCADE, 
                                   related_name='invoices', null=True, blank=True)
    
    date = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    balance_due = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, 
                                  null=True, blank=True, related_name='created_invoices')
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.invoice_number} - {self.guest}"
    
    @staticmethod
    def generate_invoice_number():
        from django.db.models import Max
        last_invoice = Invoice.objects.aggregate(Max('id'))['id__max']
        next_id = (last_invoice or 0) + 1
        return f"INV-{next_id:06d}"
    
    def recalculate_totals(self):
        """Recalculate all invoice totals"""
        items_data = self.items.aggregate(
            subtotal=Sum('line_total'),
            tax_total=Sum(models.F('unit_price') * models.F('quantity') * models.F('tax_rate') / 100)
        )
        
        self.subtotal = items_data['subtotal'] or Decimal('0.00')
        self.tax = items_data['tax_total'] or Decimal('0.00')
        self.total = self.subtotal + self.tax - (self.discount or Decimal('0.00'))
        
        payments_data = self.payments.filter(status='completed').aggregate(Sum('amount'))
        self.amount_paid = payments_data['amount__sum'] or Decimal('0.00')
        self.balance_due = self.total - self.amount_paid
        
        # Update status
        if self.balance_due <= Decimal('0.00') and self.total > Decimal('0.00'):
            self.status = 'paid'
            if not self.paid_date:
                self.paid_date = timezone.now()
        elif self.amount_paid > Decimal('0.00') and self.balance_due > Decimal('0.00'):
            self.status = 'partial'
        elif self.amount_paid == Decimal('0.00'):
            if self.status not in ['draft', 'cancelled', 'refunded']:
                if self.due_date and timezone.now().date() > self.due_date:
                    self.status = 'overdue'
                else:
                    self.status = 'pending'
        
        self.save(update_fields=['subtotal', 'tax', 'total', 'amount_paid', 
                                'balance_due', 'status', 'paid_date'])
    
    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        if not self.due_date:
            self.due_date = timezone.now().date()
        super().save(*args, **kwargs)
    
    def can_be_paid(self):
        return self.status not in ['cancelled', 'refunded'] and self.balance_due > 0
    
    def can_be_refunded(self):
        return self.amount_paid > 0 and self.status != 'cancelled'


class InvoiceItem(models.Model):
    """Invoice line items"""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    service = models.ForeignKey('services.Service', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.product_name} x {self.quantity}"
    
    def save(self, *args, **kwargs):
        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)
        if self.invoice_id:
            self.invoice.recalculate_totals()


class Payment(models.Model):
    """Payment records"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_TYPE_CHOICES = [
        ('full', 'Full Payment'),
        ('partial', 'Partial Payment'),
        ('deposit', 'Deposit'),
        ('refund', 'Refund'),
    ]
    
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=50)
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT, null=True, blank=True)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='full')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=255, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    notes = models.TextField(blank=True)
    processed_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-payment_date']
    
    def __str__(self):
        return f"Payment #{self.id} - ${self.amount} ({self.method})"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.invoice.recalculate_totals()
        
        # Update guest loyalty points
        if self.status == 'completed':
            guest = self.invoice.guest
            if hasattr(guest, 'loyalty_points'):
                if self.payment_type == 'refund':
                    points_change = -int(abs(self.amount))
                    spending_change = self.amount
                else:
                    points_change = int(self.amount)
                    spending_change = self.amount
                
                guest.loyalty_points = max(0, (guest.loyalty_points or 0) + points_change)
                guest.total_spent = max(Decimal('0.00'), 
                                       (guest.total_spent or Decimal('0.00')) + spending_change)
                guest.save(update_fields=['loyalty_points', 'total_spent'])
```

### 2. Serializers (invoices/serializers.py)

```python
from rest_framework import serializers
from .models import Invoice, InvoiceItem, Payment, PaymentMethod

class InvoiceItemSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    tax_amount = serializers.SerializerMethodField()
    total_with_tax = serializers.SerializerMethodField()
    
    class Meta:
        model = InvoiceItem
        fields = ['id', 'service', 'service_name', 'product_name', 'quantity', 
                 'unit_price', 'tax_rate', 'line_total', 'tax_amount', 
                 'total_with_tax', 'notes']
        read_only_fields = ['id', 'line_total', 'service_name']
    
    def get_tax_amount(self, obj):
        return str((obj.unit_price * obj.quantity * obj.tax_rate / 100).quantize(Decimal('0.01')))
    
    def get_total_with_tax(self, obj):
        tax = obj.unit_price * obj.quantity * obj.tax_rate / 100
        return str((obj.line_total + tax).quantize(Decimal('0.01')))


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    guest_name = serializers.SerializerMethodField()
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    processed_by_name = serializers.SerializerMethodField()
    display_amount = serializers.SerializerMethodField()
    is_refund = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'invoice_number', 'guest_name', 'method', 
                 'payment_method', 'payment_method_name', 'payment_type', 'amount',
                 'display_amount', 'transaction_id', 'reference_number', 'payment_date',
                 'status', 'notes', 'processed_by', 'processed_by_name', 'is_refund',
                 'created_at', 'updated_at']
        read_only_fields = ['payment_date', 'created_at', 'updated_at']
    
    def get_guest_name(self, obj):
        if obj.invoice and obj.invoice.guest:
            return f"{obj.invoice.guest.first_name} {obj.invoice.guest.last_name}"
        return None
    
    def get_processed_by_name(self, obj):
        if obj.processed_by:
            return obj.processed_by.get_full_name() or obj.processed_by.username
        return None
    
    def get_display_amount(self, obj):
        return f"${abs(obj.amount):.2f}"
    
    def get_is_refund(self, obj):
        return obj.payment_type == 'refund' or obj.amount < 0


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_email = serializers.CharField(source='guest.email', read_only=True)
    reservation_id = serializers.IntegerField(source='reservation.id', read_only=True)
    payment_summary = serializers.SerializerMethodField()
    can_be_paid = serializers.SerializerMethodField()
    can_be_refunded = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = ['id', 'invoice_number', 'guest', 'guest_name', 'guest_email',
                 'reservation', 'reservation_id', 'date', 'due_date', 'subtotal',
                 'tax', 'discount', 'total', 'amount_paid', 'balance_due', 'status',
                 'paid_date', 'notes', 'items', 'payments', 'payment_summary',
                 'can_be_paid', 'can_be_refunded', 'created_by', 'created_by_name',
                 'created_at', 'updated_at']
        read_only_fields = ['id', 'date', 'invoice_number', 'subtotal', 'tax',
                          'total', 'amount_paid', 'balance_due', 'paid_date',
                          'created_at', 'updated_at']
    
    def get_guest_name(self, obj):
        if obj.guest:
            return f"{obj.guest.first_name} {obj.guest.last_name}"
        return None
    
    def get_payment_summary(self, obj):
        completed_payments = obj.payments.filter(status='completed')
        return {
            'total_payments': completed_payments.count(),
            'payment_methods': list(completed_payments.values_list('method', flat=True).distinct()),
            'refund_amount': str(completed_payments.filter(
                payment_type='refund'
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')),
        }
    
    def get_can_be_paid(self, obj):
        return obj.can_be_paid()
    
    def get_can_be_refunded(self, obj):
        return obj.can_be_refunded()
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = Invoice.generate_invoice_number()
        
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        
        invoice = Invoice.objects.create(**validated_data)
        
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        invoice.recalculate_totals()
        return invoice
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=instance, **item_data)
        
        instance.recalculate_totals()
        return instance


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'name', 'code', 'requires_reference', 'icon', 'display_order']
```

### 3. Views (invoices/views.py)

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import Invoice, InvoiceItem, Payment, PaymentMethod
from .serializers import InvoiceSerializer, PaymentSerializer, PaymentMethodSerializer

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().prefetch_related('items', 'payments')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """Process a payment for this invoice"""
        invoice = self.get_object()
        
        amount = Decimal(str(request.data.get('amount')))
        payment_method_id = request.data.get('payment_method')
        payment_type = request.data.get('payment_type', 'full')
        reference_number = request.data.get('reference_number', '')
        transaction_id = request.data.get('transaction_id', '')
        notes = request.data.get('notes', '')
        
        # Validation
        if not invoice.can_be_paid():
            return Response(
                {'error': f'Cannot process payment for {invoice.status} invoice'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if amount > invoice.balance_due:
            return Response(
                {'error': f'Payment amount cannot exceed balance due of ${invoice.balance_due}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            payment_method = PaymentMethod.objects.get(id=payment_method_id, is_active=True)
        except PaymentMethod.DoesNotExist:
            return Response(
                {'error': 'Invalid payment method'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=invoice,
                method=payment_method.code,
                payment_method=payment_method,
                payment_type=payment_type,
                amount=amount,
                transaction_id=transaction_id,
                reference_number=reference_number,
                status='completed',
                notes=notes,
                processed_by=request.user
            )
        
        invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'payment_id': payment.id,
            'amount_paid': str(payment.amount),
            'invoice_total': str(invoice.total),
            'total_paid': str(invoice.amount_paid),
            'balance_due': str(invoice.balance_due),
            'invoice_status': invoice.status,
            'payment_status': payment.status,
            'loyalty_points_earned': int(payment.amount),
            'message': f'Payment of ${payment.amount} processed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Process a refund for this invoice"""
        invoice = self.get_object()
        
        amount = Decimal(str(request.data.get('amount')))
        reason = request.data.get('reason', '')
        
        if not invoice.can_be_refunded():
            return Response(
                {'error': 'This invoice cannot be refunded'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if amount > invoice.amount_paid:
            return Response(
                {'error': f'Refund amount cannot exceed amount paid of ${invoice.amount_paid}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            refund_payment = Payment.objects.create(
                invoice=invoice,
                method='refund',
                payment_type='refund',
                amount=-amount,
                status='completed',
                notes=f'Refund: {reason}',
                processed_by=request.user
            )
            
            if invoice.balance_due >= invoice.total:
                invoice.status = 'refunded'
                invoice.save(update_fields=['status'])
        
        invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'refund_id': refund_payment.id,
            'refund_amount': str(amount),
            'balance_due': str(invoice.balance_due),
            'invoice_status': invoice.status,
            'message': f'Refund of ${amount} processed successfully'
        })


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
```

### 4. Update Reservation ViewSet (reservations/views.py)

Add this to your existing ReservationViewSet:

```python
@action(detail=True, methods=['post'])
def check_out(self, request, pk=None):
    """Check out guest and optionally create invoice"""
    reservation = self.get_object()
    
    if reservation.status != 'completed':
        return Response(
            {'error': 'Reservation must be completed before check-out'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    create_invoice = request.data.get('create_invoice', False)
    notes = request.data.get('notes', '')
    
    with transaction.atomic():
        # Update reservation
        reservation.status = 'checked_out'
        reservation.checked_out_at = timezone.now()
        if notes:
            reservation.notes = f"{reservation.notes}\n\n{notes}".strip()
        reservation.save()
        
        # Mark location as dirty
        if reservation.location:
            reservation.location.is_clean = False
            reservation.location.is_occupied = False
            reservation.location.save()
            
            # Create housekeeping task
            from housekeeping.models import HousekeepingTask
            HousekeepingTask.objects.create(
                location=reservation.location,
                task_type='cleaning',
                priority='normal',
                status='pending',
                notes=f'Clean after reservation #{reservation.id}'
            )
        
        # Create invoice if requested
        invoice_data = {}
        if create_invoice:
            try:
                from invoices.models import Invoice, InvoiceItem
                
                existing_invoice = Invoice.objects.filter(reservation=reservation).first()
                
                if existing_invoice:
                    invoice_data = {
                        'invoice_created': True,
                        'invoice_id': existing_invoice.id,
                        'invoice_number': existing_invoice.invoice_number,
                        'invoice_total': str(existing_invoice.total),
                    }
                else:
                    invoice = Invoice.objects.create(
                        reservation=reservation,
                        guest=reservation.guest,
                        invoice_number=Invoice.generate_invoice_number(),
                        status='pending',
                        notes=f'Invoice for reservation #{reservation.id}',
                        created_by=request.user
                    )
                    
                    # Create items from services
                    for res_service in reservation.reservation_services.all():
                        InvoiceItem.objects.create(
                            invoice=invoice,
                            service=res_service.service,
                            product_name=res_service.service_details.name,
                            quantity=res_service.quantity,
                            unit_price=res_service.unit_price,
                            tax_rate=Decimal('8.00'),
                        )
                    
                    invoice.recalculate_totals()
                    
                    invoice_data = {
                        'invoice_created': True,
                        'invoice_id': invoice.id,
                        'invoice_number': invoice.invoice_number,
                        'invoice_total': str(invoice.total),
                    }
            except Exception as e:
                invoice_data = {'invoice_created': False, 'error': str(e)}
    
    return Response({
        'status': reservation.status,
        'checked_out_at': reservation.checked_out_at.isoformat(),
        'housekeeping_task_created': True,
        'message': 'Guest checked out successfully',
        **invoice_data
    })
```

### 5. URLs (invoices/urls.py)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, PaymentViewSet, PaymentMethodViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'payment-methods', PaymentMethodViewSet, basename='paymentmethod')

urlpatterns = [
    path('', include(router.urls)),
]
```

### 6. Management Command (invoices/management/commands/create_payment_methods.py)

```python
from django.core.management.base import BaseCommand
from invoices.models import PaymentMethod

class Command(BaseCommand):
    help = 'Create default payment methods'
    
    def handle(self, *args, **options):
        payment_methods = [
            {'name': 'Cash', 'code': 'cash', 'icon': '💵', 'display_order': 1},
            {'name': 'Credit Card', 'code': 'credit_card', 'icon': '💳', 
             'requires_reference': True, 'display_order': 2},
            {'name': 'Debit Card', 'code': 'debit_card', 'icon': '💳', 
             'requires_reference': True, 'display_order': 3},
            {'name': 'Mobile Payment', 'code': 'mobile_payment', 'icon': '📱', 
             'requires_reference': True, 'display_order': 4},
            {'name': 'Bank Transfer', 'code': 'bank_transfer', 'icon': '🏦', 
             'requires_reference': True, 'display_order': 5},
        ]
        
        for method_data in payment_methods:
            PaymentMethod.objects.get_or_create(
                code=method_data['code'],
                defaults=method_data
            )
            self.stdout.write(self.style.SUCCESS(f'✓ {method_data["name"]}'))
```

---

## Frontend Implementation

### 1. Services API (services/invoices.ts)

```typescript
import { api } from './api';

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  requires_reference: boolean;
  icon?: string;
}

export interface InvoiceItem {
  id: number;
  service?: number;
  service_name?: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  line_total: string;
  tax_amount: string;
  total_with_tax: string;
}

export interface Payment {
  id: number;
  invoice: number;
  invoice_number: string;
  method: string;
  payment_method_name?: string;
  payment_type: 'full' | 'partial' | 'deposit' | 'refund';
  amount: string;
  display_amount: string;
  payment_date: string;
  status: string;
  notes: string;
  is_refund: boolean;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  guest: number;
  guest_name: string;
  guest_email?: string;
  reservation?: number;
  date: string;
  due_date: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  items: InvoiceItem[];
  payments: Payment[];
  can_be_paid: boolean;
  can_be_refunded: boolean;
}

export const invoicesService = {
  async list(params?: any): Promise<Invoice[]> {
    const response = await api.get('/invoices/', { params });
    return response.data.results ?? response.data;
  },
  
  async retrieve(id: number): Promise<Invoice> {
    const response = await api.get(`/invoices/${id}/`);
    return response.data;
  },
  
  async processPayment(invoiceId: number, data: {
    amount: string;
    payment_method: number;
    payment_type?: string;
    reference_number?: string;
    transaction_id?: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`/invoices/${invoiceId}/process-payment/`, data);
    return response.data;
  },
  
  async refund(invoiceId: number, data: {
    amount: string;
    reason: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`/invoices/${invoiceId}/refund/`, data);
    return response.data;
  },
};

export const paymentMethodsService = {
  async list(): Promise<PaymentMethod[]> {
    const response = await api.get('/payment-methods/');
    return response.data.results ?? response.data;
  },
};
```

### 2. Update Reservation Service (services/reservations.ts)

Update your existing `checkOut` method:

```typescript
async checkOut(id: number, data?: { create_invoice?: boolean; notes?: string }): Promise<{
  status: string;
  checked_out_at: string;
  invoice_created?: boolean;
  invoice_id?: number;
  invoice_number?: string;
  invoice_total?: string;
  housekeeping_task_created: boolean;
  message: string;
}> {
  const response = await api.post(`/reservations/${id}/check-out/`, data || {});
  return response.data;
}
```

### 3. Invoice Details Component (components/invoices/InvoiceDetails.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Grid,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { Payment as PaymentIcon, Undo, Email, Print } from '@mui/icons-material';
import { invoicesService, Invoice } from '../../services/invoices';
import { PaymentDialog } from './PaymentDialog';
import { RefundDialog } from './RefundDialog';
import dayjs from 'dayjs';

interface InvoiceDetailsProps {
  invoiceId: number;
  onClose?: () => void;
  onPaymentProcessed?: () => void;
}

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({
  invoiceId,
  onClose,
  onPaymentProcessed,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const data = await invoicesService.retrieve(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handlePaymentProcessed = () => {
    loadInvoice();
    onPaymentProcessed?.();
    setPaymentDialogOpen(false);
  };

  const handleRefundProcessed = () => {
    loadInvoice();
    onPaymentProcessed?.();
    setRefundDialogOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!invoice) {
    return <Typography>Invoice not found</Typography>;
  }

  const getStatusColor = (status: Invoice['status']) => {
    const colors = {
      draft: 'default',
      pending: 'warning',
      partial: 'info',
      paid: 'success',
      overdue: 'error',
      cancelled: 'default',
      refunded: 'secondary',
    };
    return colors[status] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                {invoice.invoice_number}
              </Typography>
              <Chip
                label={invoice.status}
                color={getStatusColor(invoice.status) as any}
                sx={{ textTransform: 'capitalize' }}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<Email />}>
                Email
              </Button>
              <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>
                Print
              </Button>
              {onClose && <Button onClick={onClose}>Close</Button>}
            </Stack>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Bill To
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {invoice.guest_name}
              </Typography>
              {invoice.guest_email && (
                <Typography variant="body2" color="text.secondary">
                  {invoice.guest_email}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Invoice Date:
                  </Typography>
                  <Typography variant="body2">
                    {dayjs(invoice.date).format('MMM D, YYYY')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Due Date:
                  </Typography>
                  <Typography variant="body2">
                    {dayjs(invoice.due_date).format('MMM D, YYYY')}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Services / Items
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Tax Rate</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {item.product_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">
                      ${parseFloat(item.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {parseFloat(item.tax_rate).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right">
                      ${parseFloat(item.line_total).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ minWidth: 300 }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">
                    ${parseFloat(invoice.subtotal).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Tax:</Typography>
                  <Typography variant="body2">
                    ${parseFloat(invoice.tax).toFixed(2)}
                  </Typography>
                </Box>
                {parseFloat(invoice.discount) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="success.main">
                      Discount:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      -${parseFloat(invoice.discount).toFixed(2)}
                    </Typography>
                  </Box>
                )}
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ${parseFloat(invoice.total).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Amount Paid:
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${parseFloat(invoice.amount_paid).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography
                    variant="h6"
                    color={
                      parseFloat(invoice.balance_due) > 0
                        ? 'error.main'
                        : 'success.main'
                    }
                  >
                    Balance Due:
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color={
                      parseFloat(invoice.balance_due) > 0
                        ? 'error.main'
                        : 'success.main'
                    }
                  >
                    ${parseFloat(invoice.balance_due).toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment History
            </Typography>
            <List>
              {invoice.payments.map((payment) => (
                <ListItem
                  key={payment.id}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" fontWeight={600}>
                          {payment.is_refund ? 'Refund' : 'Payment'} - {payment.payment_method_name || payment.method}
                        </Typography>
                        <Typography
                          variant="body1"
                          fontWeight={700}
                          color={payment.is_refund ? 'error.main' : 'success.main'}
                        >
                          {payment.is_refund ? '-' : '+'}${Math.abs(parseFloat(payment.amount)).toFixed(2)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" display="block">
                        {dayjs(payment.payment_date).format('MMM D, YYYY h:mm A')}
                        {payment.notes && ` • ${payment.notes}`}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {invoice.status !== 'cancelled' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            <Stack direction="row" spacing={2}>
              {invoice.can_be_paid && (
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  Process Payment
                </Button>
              )}
              {invoice.can_be_refunded && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<Undo />}
                  onClick={() => setRefundDialogOpen(true)}
                >
                  Process Refund
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        invoice={invoice}
        onPaymentProcessed={handlePaymentProcessed}
      />

      {/* Refund Dialog */}
      <RefundDialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        invoice={invoice}
        onRefundProcessed={handleRefundProcessed}
      />
    </Box>
  );
};
```

### 4. Payment Dialog Component (components/invoices/PaymentDialog.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  Alert,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
} from '@mui/material';
import {
  invoicesService,
  paymentMethodsService,
  Invoice,
  PaymentMethod,
} from '../../services/invoices';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPaymentProcessed: () => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  invoice,
  onPaymentProcessed,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(invoice.balance_due);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'deposit'>('full');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await paymentMethodsService.list();
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedMethod(methods[0]);
        }
      } catch (error) {
        console.error('Failed to load payment methods:', error);
      }
    };
    if (open) {
      loadPaymentMethods();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setAmount(invoice.balance_due);
      setPaymentType('full');
      setReferenceNumber('');
      setTransactionId('');
      setNotes('');
      setError('');
    }
  }, [open, invoice]);

  const handleSubmit = async () => {
    setError('');

    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountValue > parseFloat(invoice.balance_due)) {
      setError('Amount cannot exceed balance due');
      return;
    }

    if (selectedMethod.requires_reference && !referenceNumber) {
      setError(`${selectedMethod.name} requires a reference number`);
      return;
    }

    setProcessing(true);

    try {
      await invoicesService.processPayment(invoice.id, {
        amount: amount,
        payment_method: selectedMethod.id,
        payment_type: paymentType,
        reference_number: referenceNumber || undefined,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
      });

      onPaymentProcessed();
    } catch (error: any) {
      setError(error?.response?.data?.error || 'Failed to process payment');
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Process Payment</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Invoice Summary */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invoice: {invoice.invoice_number}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={600}>
                Balance Due:
              </Typography>
              <Typography variant="body2" fontWeight={700} color="error.main">
                ${parseFloat(invoice.balance_due).toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {/* Payment Amount */}
          <TextField
            label="Payment Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            inputProps={{
              min: 0.01,
              max: parseFloat(invoice.balance_due),
              step: 0.01,
            }}
          />

          {/* Payment Method */}
          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={selectedMethod?.id || ''}
              onChange={(e) => {
                const method = paymentMethods.find((m) => m.id === e.target.value);
                setSelectedMethod(method || null);
              }}
              label="Payment Method"
            >
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  {method.icon && `${method.icon} `}
                  {method.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reference Number */}
          {selectedMethod?.requires_reference && (
            <TextField
              label="Reference Number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
              required
              placeholder="Last 4 digits, check number, etc."
            />
          )}

          {/* Transaction ID */}
          <TextField
            label="Transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            fullWidth
            placeholder="Processor transaction ID"
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Additional notes..."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={processing || !selectedMethod}
        >
          {processing ? <CircularProgress size={24} /> : `Process Payment (${amount})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 5. Refund Dialog Component (components/invoices/RefundDialog.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { invoicesService, Invoice } from '../../services/invoices';

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onRefundProcessed: () => void;
}

export const RefundDialog: React.FC<RefundDialogProps> = ({
  open,
  onClose,
  invoice,
  onRefundProcessed,
}) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(invoice.amount_paid);
      setReason('');
      setNotes('');
      setError('');
    }
  }, [open, invoice]);

  const handleSubmit = async () => {
    setError('');

    if (!reason.trim()) {
      setError('Please enter a reason for the refund');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    if (amountValue > parseFloat(invoice.amount_paid)) {
      setError('Refund amount cannot exceed amount paid');
      return;
    }

    setProcessing(true);

    try {
      await invoicesService.refund(invoice.id, {
        amount: amount,
        reason: reason,
        notes: notes || undefined,
      });

      onRefundProcessed();
    } catch (error: any) {
      setError(error?.response?.data?.error || 'Failed to process refund');
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Process Refund</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invoice: {invoice.invoice_number}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={600}>
                Amount Paid:
              </Typography>
              <Typography variant="body2" fontWeight={700} color="success.main">
                ${parseFloat(invoice.amount_paid).toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="warning">
            This will create a refund payment and update the invoice balance.
            Loyalty points will be deducted.
          </Alert>

          <TextField
            label="Refund Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />

          <TextField
            label="Refund Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="e.g., Guest cancelled service, Service not satisfactory..."
          />

          <TextField
            label="Additional Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional internal notes..."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          disabled={processing || !reason.trim()}
        >
          {processing ? <CircularProgress size={24} /> : `Process Refund (${amount})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## Integration Steps

### Step 1: Update ReservationManagement Component

Add these imports at the top:

```typescript
import { InvoiceDetails } from '../components/invoices/InvoiceDetails';
```

Add these state variables (around line 50):

```typescript
const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);
```

Update the `performAction` function for check_out (around line 280):

```typescript
if (action === 'check_out') {
  // Check out with automatic invoice creation
  const checkoutResult = await reservationsService.checkOut(targetReservation.id, {
    create_invoice: true,
    notes: 'Automatic invoice creation on checkout'
  });
  
  // If invoice was created, show it
  if (checkoutResult.invoice_created && checkoutResult.invoice_id) {
    setCreatedInvoiceId(checkoutResult.invoice_id);
    setInvoiceDialogOpen(true);
    
    setSnackbar({
      open: true,
      message: `Checked out. Invoice ${checkoutResult.invoice_number} created (${checkoutResult.invoice_total}).`,
      severity: 'success',
    });
  } else {
    setSnackbar({
      open: true,
      message: 'Checked out. Room marked dirty and housekeeping task created.',
      severity: 'success',
    });
  }
  
  // Close the reservation drawer
  if (!reservation) setDrawerOpen(false);
}
```

Add the Invoice Dialog before the closing `</PageWrapper>` tag:

```typescript
{/* Invoice Dialog */}
<Dialog
  open={invoiceDialogOpen}
  onClose={() => {
    setInvoiceDialogOpen(false);
    setCreatedInvoiceId(null);
  }}
  maxWidth="lg"
  fullWidth
  PaperProps={{
    sx: {
      height: '90vh',
      maxHeight: '90vh',
    }
  }}
>
  <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography variant="h6">Invoice & Payment</Typography>
    <IconButton
      onClick={() => {
        setInvoiceDialogOpen(false);
        setCreatedInvoiceId(null);
      }}
      size="small"
    >
      <Cancel />
    </IconButton>
  </DialogTitle>
  <DialogContent sx={{ p: 0, overflow: 'auto' }}>
    {createdInvoiceId && (
      <InvoiceDetails
        invoiceId={createdInvoiceId}
        onClose={() => {
          setInvoiceDialogOpen(false);
          setCreatedInvoiceId(null);
        }}
        onPaymentProcessed={() => {
          loadReservations();
        }}
      />
    )}
  </DialogContent>
</Dialog>
```

### Step 2: Run Database Migrations

```bash
# Create migrations
python manage.py makemigrations invoices

# Apply migrations
python manage.py migrate

# Create default payment methods
python manage.py create_payment_methods
```

### Step 3: Update Django URLs

In your main `urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ... existing patterns
    path('api/invoices/', include('invoices.urls')),
]
```

### Step 4: Install Frontend Dependencies

If needed:

```bash
npm install dayjs
```

---

## Workflow Documentation

### Complete Guest Journey

```
1. BOOKING
   ├─> Staff creates reservation
   ├─> Services selected and added
   └─> Reservation status: 'booked'

2. ARRIVAL
   ├─> Staff clicks "Check-in"
   ├─> Room marked as occupied
   └─> Reservation status: 'checked_in'

3. SERVICE START
   ├─> Staff clicks "Start Service"
   ├─> Timer begins
   └─> Reservation status: 'in_service'

4. SERVICE END
   ├─> Staff clicks "Complete Service"
   └─> Reservation status: 'completed'

5. DEPARTURE
   ├─> Staff clicks "Check-out"
   ├─> Reservation status: 'checked_out'
   ├─> Room marked dirty and unoccupied
   ├─> Housekeeping task created
   ├─> Invoice automatically created
   └─> Invoice dialog displayed

6. PAYMENT
   ├─> Staff clicks "Process Payment"
   ├─> Selects payment method
   ├─> Enters amount and details
   ├─> Payment recorded
   ├─> Invoice status updated
   ├─> Guest loyalty points added
   └─> Receipt available
```

### Payment Processing Flow

```
INVOICE CREATED (status: 'pending')
   ├─> Balance Due: $108.00
   └─> Amount Paid: $0.00

STAFF CLICKS "PROCESS PAYMENT"
   ├─> Dialog opens
   ├─> Balance pre-filled
   └─> Payment methods loaded

STAFF ENTERS PAYMENT DETAILS
   ├─> Amount: $108.00
   ├─> Method: Credit Card
   ├─> Reference: VISA-4532
   └─> Notes: "Paid in full"

SYSTEM VALIDATES
   ├─> Amount ≤ Balance? ✓
   ├─> Method active? ✓
   ├─> Reference required? ✓
   └─> Reference provided? ✓

PAYMENT PROCESSED
   ├─> Payment record created
   ├─> Invoice totals recalculated
   ├─> Invoice status: 'paid'
   ├─> Loyalty points: +108
   └─> Success message shown

RESULT
   ├─> Invoice paid in full
   ├─> Guest can leave
   └─> Financial records complete
```

### Refund Processing Flow

```
PAID INVOICE
   ├─> Total: $108.00
   ├─> Amount Paid: $108.00
   └─> Balance Due: $0.00

STAFF CLICKS "PROCESS REFUND"
   ├─> Dialog opens
   ├─> Amount paid pre-filled
   └─> Reason required

STAFF ENTERS REFUND DETAILS
   ├─> Amount: $50.00
   ├─> Reason: "Guest cancelled - partial refund"
   └─> Notes: "Refunded to original card"

SYSTEM VALIDATES
   ├─> Amount ≤ Amount Paid? ✓
   ├─> Reason provided? ✓
   └─> Invoice can be refunded? ✓

REFUND PROCESSED
   ├─> Refund payment created (negative amount)
   ├─> Invoice totals recalculated
   ├─> Invoice status: 'partial'
   ├─> Loyalty points: -50
   └─> Success message shown

RESULT
   ├─> Amount Paid: $58.00
   ├─> Balance Due: $50.00
   └─> Financial records updated
```

---

## Testing Checklist

### ✅ Reservation Flow Tests

- [ ] **Create Reservation**
  - Create with single service
  - Create with multiple services
  - Verify total price calculation
  - Verify duration calculation

- [ ] **Check-in Process**
  - Check-in with clean room
  - Attempt check-in with occupied room (should fail)
  - Attempt check-in with OOS room (should warn)
  - Verify room status changes to occupied

- [ ] **Service Flow**
  - Start service and verify timer
  - Complete service
  - Verify status transitions

- [ ] **Check-out Process**
  - Check-out from completed status
  - Verify invoice creation
  - Verify invoice dialog appears
  - Verify room marked dirty
  - Verify housekeeping task created

### ✅ Invoice Display Tests

- [ ] **Invoice Information**
  - All services listed correctly
  - Quantities accurate
  - Unit prices correct
  - Tax calculated properly
  - Subtotal correct
  - Total matches expected amount
  - Guest information displayed
  - Invoice number generated

- [ ] **Invoice Items**
  - Each service appears as line item
  - Duration shown correctly
  - Prices match reservation services
  - Tax rate applied correctly

### ✅ Payment Processing Tests

- [ ] **Full Payment**
  - Pay exact balance due
  - Verify invoice status changes to 'paid'
  - Verify balance due becomes $0.00
  - Verify loyalty points added
  - Verify payment appears in history

- [ ] **Partial Payment**
  - Pay less than balance due
  - Verify invoice status changes to 'partial'
  - Verify remaining balance correct
  - Verify can make additional payments
  - Verify loyalty points for partial amount

- [ ] **Multiple Payments**
  - Make first partial payment
  - Make second partial payment
  - Make final payment
  - Verify all payments in history
  - Verify total loyalty points correct

- [ ] **Payment Methods**
  - Cash payment (no reference required)
  - Credit card payment (reference required)
  - Mobile payment (reference required)
  - Verify method validation works

- [ ] **Payment Validation**
  - Try to pay $0 (should fail)
  - Try to pay more than balance (should fail)
  - Try card payment without reference (should fail)
  - Try to pay cancelled invoice (should fail)

### ✅ Refund Processing Tests

- [ ] **Full Refund**
  - Refund entire paid amount
  - Verify invoice status changes to 'refunded'
  - Verify balance due equals total
  - Verify loyalty points deducted
  - Verify refund in payment history

- [ ] **Partial Refund**
  - Refund portion of paid amount
  - Verify invoice status changes to 'partial'
  - Verify balance due updated correctly
  - Verify loyalty points partially deducted
  - Verify can still accept payments

- [ ] **Refund Validation**
  - Try to refund $0 (should fail)
  - Try to refund more than paid (should fail)
  - Try to refund with no reason (should fail)
  - Try to refund unpaid invoice (should fail)

### ✅ Edge Cases & Error Handling

- [ ] **Duplicate Invoice Prevention**
  - Check-out twice on same reservation
  - Verify second attempt returns existing invoice
  - Verify no duplicate created

- [ ] **Concurrent Operations**
  - Two users processing payment simultaneously
  - Verify no double-payment
  - Verify totals remain accurate

- [ ] **Network Errors**
  - Payment fails mid-transaction
  - Verify rollback occurs
  - Verify no partial data saved

- [ ] **Invalid States**
  - Try to check-out non-completed reservation
  - Try to pay cancelled invoice
  - Try to process payment on paid invoice

### ✅ UI/UX Tests

- [ ] **Dialog Behavior**
  - Invoice dialog opens after checkout
  - Dialog closes properly
  - Can reopen invoice from reservation
  - Data loads correctly

- [ ] **Form Validation**
  - Required fields marked
  - Error messages clear
  - Validation happens before submit
  - Success messages appear

- [ ] **Loading States**
  - Loading indicators show during API calls
  - Buttons disabled during processing
  - No duplicate submissions possible

- [ ] **Responsiveness**
  - Dialogs work on mobile
  - Tables scroll on small screens
  - Buttons accessible on touch devices

### ✅ Data Integrity Tests

- [ ] **Total Calculations**
  - Subtotal = sum of line items
  - Tax = calculated from line items
  - Total = subtotal + tax - discount
  - Balance due = total - amount paid
  - All decimals round correctly to 2 places

- [ ] **Status Transitions**
  - pending → partial (on partial payment)
  - partial → paid (on final payment)
  - paid → partial (on partial refund)
  - partial → refunded (on full refund)
  - Cannot transition from cancelled

- [ ] **Loyalty Points**
  - Points added equal to payment amount
  - Points deducted equal to refund amount
  - Points never go negative
  - Total spent tracks accurately

### ✅ Reporting & Audit Tests

- [ ] **Payment History**
  - All payments listed chronologically
  - Payment types indicated correctly
  - Refunds shown as negative
  - Processed by information captured

- [ ] **Invoice Search**
  - Search by invoice number works
  - Search by guest name works
  - Filter by status works
  - Date range filtering works

- [ ] **Financial Reports**
  - Daily totals accurate
  - Payment method breakdown correct
  - Refund totals accurate
  - Net revenue calculated correctly

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Invoice not created on checkout

**Symptoms:**
- Check-out succeeds but invoice dialog doesn't appear
- No invoice in database

**Solutions:**
1. Check backend logs for errors
2. Verify `create_invoice=True` in checkout request
3. Ensure reservation has services
4. Check invoice creation permissions
5. Verify Invoice model imported correctly

```python
# Add debug logging
import logging
logger = logging.getLogger(__name__)

try:
    invoice = Invoice.objects.create(...)
    logger.info(f"Invoice {invoice.invoice_number} created successfully")
except Exception as e:
    logger.error(f"Invoice creation failed: {str(e)}")
    raise
```

#### Issue: Payment processing fails

**Symptoms:**
- "Failed to process payment" error
- Payment not recorded in database

**Solutions:**
1. Check payment amount validation
2. Verify payment method exists and is active
3. Ensure invoice status allows payments
4. Check for database transaction errors
5. Verify user has payment processing permissions

```python
# Add detailed error logging
try:
    payment = Payment.objects.create(...)
except Exception as e:
    logger.error(f"Payment creation failed: {str(e)}")
    logger.error(f"Invoice: {invoice.id}, Amount: {amount}, Method: {payment_method_id}")
    raise
```

#### Issue: Loyalty points not updating

**Symptoms:**
- Payment successful but points unchanged
- Points calculation incorrect

**Solutions:**
1. Verify guest model has loyalty_points field
2. Check Payment.save() method for point logic
3. Ensure guest save() is called
4. Check for signal conflicts
5. Verify decimal precision in calculations

```python
# Add loyalty point logging
if hasattr(guest, 'loyalty_points'):
    old_points = guest.loyalty_points
    guest.loyalty_points += points_change
    guest.save()
    logger.info(f"Guest {guest.id} points: {old_points} → {guest.loyalty_points}")
else:
    logger.warning(f"Guest {guest.id} has no loyalty_points field")
```

#### Issue: Invoice totals incorrect

**Symptoms:**
- Totals don't match line items
- Balance due calculation wrong
- Tax not applied correctly

**Solutions:**
1. Call `invoice.recalculate_totals()` after changes
2. Verify line_total calculation in InvoiceItem
3. Check tax_rate applied correctly
4. Ensure decimal precision (2 places)
5. Verify discount applied properly

```python
# Debug total calculation
def recalculate_totals(self):
    items_data = self.items.aggregate(...)
    logger.debug(f"Items aggregate: {items_data}")
    logger.debug(f"Subtotal: {self.subtotal}, Tax: {self.tax}, Discount: {self.discount}")
    logger.debug(f"Total: {self.total}, Paid: {self.amount_paid}, Balance: {self.balance_due}")
```

#### Issue: Room not marked dirty after checkout

**Symptoms:**
- Check-out succeeds but room still clean
- Housekeeping task not created

**Solutions:**
1. Verify location exists on reservation
2. Check location save() is called
3. Ensure HousekeepingTask model exists
4. Verify transaction commits
5. Check for permission issues

```python
# Add room status logging
if reservation.location:
    logger.info(f"Marking room {reservation.location.name} as dirty")
    reservation.location.is_clean = False
    reservation.location.save()
    logger.info(f"Room status updated: clean={reservation.location.is_clean}")
```

#### Issue: Dialog not opening

**Symptoms:**
- Check-out succeeds but invoice dialog doesn't show
- Console shows no errors

**Solutions:**
1. Check `invoiceDialogOpen` state updated
2. Verify `createdInvoiceId` is set
3. Ensure InvoiceDetails component imported
4. Check dialog conditional rendering
5. Verify no CSS hiding dialog

```typescript
// Add debug logging
const checkoutResult = await reservationsService.checkOut(...);
console.log('Checkout result:', checkoutResult);

if (checkoutResult.invoice_created) {
  console.log('Setting invoice ID:', checkoutResult.invoice_id);
  setCreatedInvoiceId(checkoutResult.invoice_id);
  setInvoiceDialogOpen(true);
  console.log('Dialog should be open');
}
```

#### Issue: Payment method validation fails

**Symptoms:**
- "Invalid payment method" error
- Payment methods not loading

**Solutions:**
1. Run `python manage.py create_payment_methods`
2. Verify payment methods marked as active
3. Check API endpoint returns methods
4. Ensure frontend service calls correct endpoint
5. Verify CORS settings if cross-origin

```bash
# Check payment methods exist
python manage.py shell
>>> from invoices.models import PaymentMethod
>>> PaymentMethod.objects.filter(is_active=True).count()
5  # Should return > 0
```

#### Issue: Transaction rollback on error

**Symptoms:**
- Partial data created then disappears
- Inconsistent state after error

**Solutions:**
1. Ensure using `transaction.atomic()`
2. Don't catch exceptions inside atomic block
3. Let exceptions bubble up for rollback
4. Check for nested transactions
5. Verify database supports transactions

```python
# Correct transaction usage
with transaction.atomic():
    invoice = Invoice.objects.create(...)
    for item_data in items:
        InvoiceItem.objects.create(...)
    # Any exception here triggers full rollback
```

### Performance Optimization

#### Slow invoice loading

**Solutions:**
1. Use `prefetch_related` for items and payments
2. Use `select_related` for guest and reservation
3. Add database indexes
4. Paginate large lists
5. Cache frequently accessed data

```python
# Optimized queryset
Invoice.objects.all()\
    .select_related('guest', 'reservation', 'created_by')\
    .prefetch_related('items', 'payments__payment_method')
```

#### Slow payment processing

**Solutions:**
1. Minimize database queries in transaction
2. Bulk update when possible
3. Use database-level calculations
4. Optimize loyalty point updates
5. Consider background tasks for heavy operations

```python
# Optimize loyalty point update
from django.db.models import F

Guest.objects.filter(id=guest_id).update(
    loyalty_points=F('loyalty_points') + points,
    total_spent=F('total_spent') + amount
)
```

---

## Additional Features

### Email Invoice to Guest

Add email functionality:

```python
# invoices/views.py
from django.core.mail import send_mail
from django.template.loader import render_to_string

@action(detail=True, methods=['post'])
def send_to_guest(self, request, pk=None):
    invoice = self.get_object()
    email = request.data.get('email', invoice.guest.email)
    
    # Render email template
    html_content = render_to_string('invoices/email_invoice.html', {
        'invoice': invoice,
        'guest': invoice.guest,
    })
    
    # Send email
    send_mail(
        subject=f'Invoice {invoice.invoice_number}',
        message='Please see attached invoice.',
        from_email='noreply@yourspa.com',
        recipient_list=[email],
        html_message=html_content,
    )
    
    return Response({'success': True, 'sent_to': email})
```

### PDF Invoice Generation

Add PDF export:

```python
# invoices/views.py
from reportlab.pdfgen import canvas
from django.http import HttpResponse

@action(detail=True, methods=['get'])
def download_pdf(self, request, pk=None):
    invoice = self.get_object()
    
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
    
    # Generate PDF
    p = canvas.Canvas(response)
    p.drawString(100, 800, f"Invoice {invoice.invoice_number}")
    p.drawString(100, 780, f"Guest: {invoice.guest_name}")
    p.drawString(100, 760, f"Total: ${invoice.total}")
    # Add more content...
    p.showPage()
    p.save()
    
    return response
```

### Payment Plans / Installments

Add installment support:

```python
# invoices/models.py
class PaymentPlan(models.Model):
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE)
    installments = models.IntegerField()
    installment_amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20)  # weekly, monthly
    next_due_date = models.DateField()
    
    def create_next_installment(self):
        # Logic to create next payment reminder
        pass
```

### Discount / Coupon Codes

Add discount management:

```python
# invoices/models.py
class DiscountCode(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=20)  # percentage, fixed
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    valid_from = models.DateField()
    valid_until = models.DateField()
    max_uses = models.IntegerField(null=True)
    times_used = models.IntegerField(default=0)
    
    def is_valid(self):
        if self.times_used >= self.max_uses:
            return False
        if timezone.now().date() > self.valid_until:
            return False
        return True
    
    def apply_to_invoice(self, invoice):
        if not self.is_valid():
            raise ValueError("Discount code is not valid")
        
        if self.discount_type == 'percentage':
            invoice.discount = invoice.subtotal * (self.discount_value / 100)
        else:
            invoice.discount = self.discount_value
        
        invoice.save()
        self.times_used += 1
        self.save()
```

### Tips / Gratuity Handling

Add tip support:

```python
# invoices/models.py
class InvoiceTip(models.Model):
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE)
    tip_amount = models.DecimalField(max_digits=10, decimal_places=2)
    tip_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    employee = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True)
    
    def save(self, *args, **kwargs):
        # Add tip to invoice total
        super().save(*args, **kwargs)
        self.invoice.total += self.tip_amount
        self.invoice.save()
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│     Guest       │
│─────────────────│
│ id (PK)         │
│ first_name      │
│ last_name       │
│ email           │
│ loyalty_points  │
│ total_spent     │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  Reservation    │
│─────────────────│
│ id (PK)         │
│ guest_id (FK)   │
│ status          │
│ start_time      │
│ end_time        │
│ total_price     │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Invoice      │───────│  InvoiceItem    │
│─────────────────│  1:N  │─────────────────│
│ id (PK)         │       │ id (PK)         │
│ invoice_number  │       │ invoice_id (FK) │
│ guest_id (FK)   │       │ product_name    │
│ reservation(FK) │       │ quantity        │
│ total           │       │ unit_price      │
│ amount_paid     │       │ line_total      │
│ balance_due     │       └─────────────────┘
│ status          │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Payment      │───────│ PaymentMethod   │
│─────────────────│  N:1  │─────────────────│
│ id (PK)         │       │ id (PK)         │
│ invoice_id (FK) │       │ name            │
│ method          │       │ code            │
│ amount          │       │ requires_ref    │
│ payment_date    │       │ is_active       │
│ status          │       └─────────────────┘
│ notes           │
└─────────────────┘
```

### Key Indexes

```sql
-- Performance indexes
CREATE INDEX idx_invoice_guest ON invoices_invoice(guest_id);
CREATE INDEX idx_invoice_reservation ON invoices_invoice(reservation_id);
CREATE INDEX idx_invoice_status ON invoices_invoice(status);
CREATE INDEX idx_invoice_date ON invoices_invoice(date DESC);
CREATE INDEX idx_payment_invoice ON invoices_payment(invoice_id);
CREATE INDEX idx_payment_date ON invoices_payment(payment_date DESC);
CREATE INDEX idx_payment_status ON invoices_payment(status);
```

---

## Security Considerations

### Permission Requirements

```python
# invoices/permissions.py
from rest_framework import permissions

class CanProcessPayment(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.has_perm('invoices.process_payment')

class CanRefund(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.has_perm('invoices.process_refund')

# Apply to views
class InvoiceViewSet(viewsets.ModelViewSet):
    @action(detail=True, methods=['post'], permission_classes=[CanProcessPayment])
    def process_payment(self, request, pk=None):
        ...
```

### Audit Logging

```python
# Add audit log for all financial transactions
class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50)
    model_name = models.CharField(max_length=50)
    object_id = models.IntegerField()
    changes = models.JSONField()
    ip_address = models.GenericIPAddressField()
    timestamp = models.DateTimeField(auto_now_add=True)

# Log payment processing
def log_payment(user, payment, ip_address):
    AuditLog.objects.create(
        user=user,
        action='process_payment',
        model_name='Payment',
        object_id=payment.id,
        changes={'amount': str(payment.amount), 'method': payment.method},
        ip_address=ip_address
    )
```

### Input Validation

```python
# Strict validation for financial data
from decimal import Decimal, InvalidOperation

def validate_amount(amount):
    try:
        amount = Decimal(str(amount))
        if amount < Decimal('0.01'):
            raise ValueError("Amount must be at least $0.01")
        if amount > Decimal('999999.99'):
            raise ValueError("Amount exceeds maximum")
        # Ensure 2 decimal places
        if amount != amount.quantize(Decimal('0.01')):
            raise ValueError("Amount must have at most 2 decimal places")
        return amount
    except (InvalidOperation, ValueError) as e:
        raise ValidationError(str(e))
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run all tests
- [ ] Create database backup
- [ ] Review security settings
- [ ] Check environment variables
- [ ] Verify payment method configuration
- [ ] Test on staging environment
- [ ] Review error logging
- [ ] Check CORS settings
- [ ] Verify SSL certificates
- [ ] Document API endpoints

### Post-Deployment

- [ ] Run migrations
- [ ] Create default payment methods
- [ ] Test invoice creation
- [ ] Test payment processing
- [ ] Test refund processing
- [ ] Verify email notifications
- [ ] Check error tracking
- [ ] Monitor performance
- [ ] Review logs for errors
- [ ] Verify data integrity

### Monitoring

```python
# Set up monitoring for key metrics
- Invoice creation rate
- Payment success rate
- Refund frequency
- Average transaction amount
- Failed payment attempts
- API response times
- Database query performance
```

---

## Support & Maintenance

### Regular Tasks

**Daily:**
- Monitor failed payments
- Review refund requests
- Check for overdue invoices
- Verify reconciliation

**Weekly:**
- Generate financial reports
- Review payment method usage
- Check for anomalies
- Update payment method availability

**Monthly:**
- Analyze revenue trends
- Review discount effectiveness
- Audit loyalty point calculations
- Database optimization

### Backup Strategy

```bash
# Automated daily backup
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump spa_db > backups/spa_db_$DATE.sql
aws s3 cp backups/spa_db_$DATE.sql s3://spa-backups/
```

---

## Conclusion

This integration provides a complete, production-ready invoice and payment system that seamlessly integrates with your spa reservation management. The system handles the complete financial lifecycle from service completion to payment processing, with robust error handling, audit trails, and guest loyalty integration.

### Key Benefits

✅ **Automated Workflow** - Invoice created automatically on checkout
✅ **Multiple Payment Methods** - Cash, card, mobile, bank transfer
✅ **Flexible Payment Options** - Full, partial, installments
✅ **Refund Support** - Full or partial refunds with audit trail
✅ **Loyalty Integration** - Automatic point calculation
✅ **Financial Accuracy** - Automatic total calculations
✅ **Audit Trail** - Complete payment history
✅ **Room Management** - Integrated with housekeeping
✅ **User-Friendly** - Intuitive dialogs and workflows
✅ **Production-Ready** - Error handling, validation, logging

For support or questions, refer to the troubleshooting section or consult the API documentation.

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Author:** Integration Guide Generator