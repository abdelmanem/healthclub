# POS Payment System - Progress Review & Remaining Issues

## ✅ What You've Fixed Successfully

### 1. **Payment Model - FIXED** ✅
- ✅ Payments now ONLY accept positive amounts
- ✅ Removed negative payment logic
- ✅ Cleaned up payment types (regular, deposit_application, manual)
- ✅ Removed `is_refunded`, `refund_amount`, `refund_date` fields from Payment
- ✅ Payment validation enforces positive amounts

### 2. **Refund Model - FIXED** ✅
- ✅ Refunds are completely separate from Payments
- ✅ Refunds ONLY track positive amounts (money OUT)
- ✅ Proper approval workflow (pending → approved → processed)
- ✅ Refund validation prevents over-refunding
- ✅ Guest loyalty points deducted in `_update_guest_loyalty()`

### 3. **Invoice Calculation - MOSTLY FIXED** ✅
- ✅ `recalculate_totals()` now calculates: payments - refunds
- ✅ Uses `get_total_paid()` and `get_total_refunded()` helpers
- ✅ `amount_paid` correctly reflects net amount (payments - refunds)
- ✅ Proper row-level locking with `select_for_update()`

### 4. **Deposit Logic - FIXED** ✅
- ✅ Deposits tracked separately until applied
- ✅ `apply_to_invoice()` creates Payment record when applied
- ✅ `remaining_amount` property works correctly
- ✅ Status transitions properly (collected → partially_applied → fully_applied)

---

## ⚠️ Remaining Issues to Fix

### Issue #1: Missing `can_be_refunded()` method on Payment ⚠️
**Location:** `serializers.py` line references `payment.can_be_refunded()` but it's not defined in your Payment model

**Problem:**
```python
# In RefundSerializer.validate_payment_id():
if not payment.can_be_refunded():  # ❌ Method doesn't exist!
    raise serializers.ValidationError("This payment cannot be refunded")
```

**Fix:** Add this to your Payment model:
```python
def can_be_refunded(self):
    """Check if this payment can be refunded"""
    # Get total already refunded for this specific payment
    refunded_amount = self.refunds.filter(
        status='processed'
    ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    
    return (
        self.status == 'completed' and
        self.amount > 0 and
        refunded_amount < self.amount  # Not fully refunded yet
    )
```

### Issue #2: Undefined variable in refund() view ⚠️
**Location:** `views.py` in `InvoiceViewSet.refund()`

**Problem:**
```python
return Response({
    'refund_payment_id': refund_payment.id,  # ❌ refund_payment not defined!
    ...
})
```

**Fix:** You removed the code that creates `refund_payment` but still reference it. Remove that line:
```python
return Response({
    'success': True,
    'refund_id': refund.id,
    # 'refund_payment_id': refund_payment.id,  # Remove this line
    'refund_amount': str(amount),
    ...
})
```

### Issue #3: Duplicate `apply_discount()` method ⚠️
**Location:** `views.py` in `InvoiceViewSet`

**Problem:** You have `apply_discount()` defined TWICE (lines ~300 and ~600)

**Fix:** Remove one of them (keep the more complete version with optimistic locking)

---

## 🔧 Quick Fix Patches

### Patch 1: Add `can_be_refunded()` to Payment Model

```python
# Add to Payment model in models.py
def can_be_refunded(self):
    """
    Check if this payment can be refunded
    A payment can be refunded if:
    - It's completed
    - It's positive (not already a refund)
    - Not fully refunded yet
    """
    # Calculate total refunded against this payment
    refunded_amount = self.refunds.filter(
        status='processed'
    ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    
    return (
        self.status == 'completed' and
        self.amount > 0 and
        refunded_amount < self.amount
    )

def get_remaining_refundable_amount(self):
    """Get how much of this payment can still be refunded"""
    refunded_amount = self.refunds.filter(
        status='processed'
    ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    
    return self.amount - refunded_amount
```

### Patch 2: Fix `refund()` view response

```python
# In views.py, InvoiceViewSet.refund() method
# Replace the return Response section with:

return Response({
    'success': True,
    'refund_id': refund.id,
    # Removed: 'refund_payment_id': refund_payment.id,  # This doesn't exist
    'refund_amount': str(amount),
    'refund_reason': reason,
    'remaining_paid': str(invoice.amount_paid),
    'balance_due': str(invoice.balance_due),
    'invoice_status': invoice.status,
    'loyalty_points_deducted': int(amount),
    'version': invoice.version,
    'message': f'Refund of ${amount} processed successfully'
})
```

### Patch 3: Remove duplicate `apply_discount()` method

```python
# In views.py, InvoiceViewSet
# Keep ONLY the first apply_discount() method (around line 300)
# DELETE the second one (around line 600)
# They're identical except the first has better error handling
```

---

## 🎯 Additional Recommendations

### Enhancement 1: Add Refund Transaction Reference

Since you're no longer creating negative Payment records for refunds, you might want to track the refund transaction separately:

```python
# In views.py, refund() method, add transaction tracking:
refund = Refund.objects.create(
    invoice=invoice_locked,
    original_payment=payment_to_refund if payment_to_refund else None,
    amount=amount,
    reason=reason,
    refund_method='original_payment',
    status='processed',
    requested_by=request.user,
    approved_by=request.user,
    processed_by=request.user,
    processed_at=timezone.now(),
    transaction_id=request.data.get('transaction_id', ''),  # Add this
    reference=request.data.get('reference', ''),  # Add this
)
```

### Enhancement 2: Add Deposit Status Filter

```python
# In views.py, add new action to InvoiceViewSet:
@action(detail=True, methods=['get'])
def available_deposits(self, request, pk=None):
    """
    Get available deposits for this invoice's guest
    GET /api/invoices/{id}/available_deposits/
    """
    invoice = self.get_object()
    
    deposits = Deposit.objects.filter(
        guest=invoice.guest,
        status__in=['collected', 'partially_applied']
    ).exclude(
        remaining_amount=0
    ).order_by('-collected_at')
    
    serializer = DepositSerializer(deposits, many=True)
    
    total_available = sum(d.remaining_amount for d in deposits)
    
    return Response({
        'invoice_id': invoice.id,
        'guest_name': f"{invoice.guest.first_name} {invoice.guest.last_name}",
        'available_deposits_count': deposits.count(),
        'total_available_amount': str(total_available),
        'deposits': serializer.data
    })
```

### Enhancement 3: Add Invoice Financial Timeline

```python
# Add to Invoice model for better audit trail:
def get_financial_timeline(self):
    """
    Get chronological timeline of all financial events
    Returns payments and refunds in order
    """
    events = []
    
    # Add payments
    for payment in self.payments.filter(status='completed'):
        events.append({
            'type': 'payment',
            'id': payment.id,
            'date': payment.payment_date,
            'amount': payment.amount,
            'method': payment.method,
            'description': f'Payment via {payment.method}',
            'balance_impact': payment.amount,  # Positive
        })
    
    # Add refunds
    for refund in self.refunds.filter(status='processed'):
        events.append({
            'type': 'refund',
            'id': refund.id,
            'date': refund.processed_at,
            'amount': refund.amount,
            'method': refund.refund_method,
            'description': f'Refund: {refund.reason[:50]}',
            'balance_impact': -refund.amount,  # Negative
        })
    
    # Sort by date
    events.sort(key=lambda x: x['date'])
    
    # Calculate running balance
    running_balance = Decimal('0.00')
    for event in events:
        running_balance += event['balance_impact']
        event['running_balance'] = str(running_balance)
        event['amount'] = str(event['amount'])
        event['balance_impact'] = str(event['balance_impact'])
    
    return events
```

---

## 📊 Testing Checklist

Before deploying, test these scenarios:

### ✅ Payment Tests
- [ ] Create payment for full invoice amount
- [ ] Create partial payment
- [ ] Try to overpay (should fail)
- [ ] Check guest loyalty points increase correctly
- [ ] Verify invoice status changes: issued → partial → paid
- [ ] Test idempotency (same payment twice should fail/return existing)

### ✅ Refund Tests
- [ ] Full refund on paid invoice
- [ ] Partial refund
- [ ] Try to over-refund (should fail)
- [ ] Check guest loyalty points decrease correctly
- [ ] Verify invoice status changes: paid → partial
- [ ] Refund specific payment (using `payment_id` parameter)

### ✅ Deposit Tests
- [ ] Collect deposit for guest
- [ ] Apply full deposit to invoice
- [ ] Apply partial deposit to invoice
- [ ] Check deposit status changes correctly
- [ ] Verify deposit creates Payment when applied
- [ ] Try to apply expired deposit (should fail)

### ✅ Concurrent Access Tests
- [ ] Two staff process payment simultaneously (optimistic locking)
- [ ] Payment + refund at same time
- [ ] Multiple deposits applied concurrently

### ✅ Edge Cases
- [ ] Refund when multiple payments exist
- [ ] Apply discount after partial payment
- [ ] Cancel invoice with deposits
- [ ] Deposit expires before application

---

## 🎉 Summary

### What's Working Great:
1. ✅ **Clean separation**: Payments IN, Refunds OUT
2. ✅ **No negative amounts anywhere**
3. ✅ **Deposit flow is clear**: collected → applied
4. ✅ **Invoice calculations are correct**
5. ✅ **Proper locking prevents race conditions**
6. ✅ **Loyalty points tracked correctly**

### What Needs Minor Fixes:
1. ⚠️ Add `can_be_refunded()` method to Payment (5 lines)
2. ⚠️ Remove `refund_payment_id` from refund() response (1 line)
3. ⚠️ Delete duplicate `apply_discount()` method (30 lines)

### Architecture Score: **9/10** 🌟

You've successfully transformed a confused payment system into a clean, maintainable architecture. The fixes needed are minor cosmetic issues, not fundamental problems.

**Great job!** 🎊

---

## ✅ Recommended Solution Architecture

### **Core Principle: Separate Concerns**

```
┌─────────────────────────────────────────────────┐
│                   INVOICE                        │
│  (What the guest owes)                          │
│  - subtotal, tax, service_charge, discount      │
│  - total (calculated)                           │
└─────────────────────────────────────────────────┘
                     ▲
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│   PAYMENT      │       │    REFUND      │
│ (Money IN)     │       │  (Money OUT)   │
│ - amount > 0   │       │  - amount > 0  │
│ - ONLY adds    │       │  - ONLY subtr. │
└────────────────┘       └────────────────┘
        ▲
        │
┌───────┴────────┐
│    DEPOSIT     │
│ (Pre-payment)  │
│ - Collected    │
│ - Applied via  │
│   Payment      │
└────────────────┘
```

---

## 📋 Detailed Fixes

### Fix 1: Clean Payment Model

**Remove mixed responsibilities:**

```python
class Payment(models.Model):
    """
    Records money RECEIVED from guests
    ONLY positive amounts
    """
    
    PAYMENT_TYPE_CHOICES = [
        ('regular', 'Regular Payment'),
        ('deposit_application', 'Deposit Application'),
        ('manual', 'Manual Adjustment'),
    ]
    
    invoice = models.ForeignKey('pos.Invoice', on_delete=models.CASCADE, related_name='payments')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT)
    
    # Core fields
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]  # MUST be positive
    )
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='regular')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="completed")
    
    # Linking
    deposit = models.ForeignKey(
        'pos.Deposit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applied_payments',
        help_text='If this payment came from applying a deposit'
    )
    
    # Transaction tracking
    transaction_id = models.CharField(max_length=100, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    
    # Idempotency
    idempotency_key = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    
    # Metadata
    notes = models.TextField(blank=True)
    processed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def clean(self):
        """Validation: Payments must be positive"""
        if self.amount <= 0:
            raise ValidationError("Payment amount must be positive")
        
        # Check if amount exceeds balance (only for new payments)
        if not self.pk and self.status == 'completed':
            if self.amount > self.invoice.balance_due:
                raise ValidationError(
                    f"Payment ${self.amount} exceeds balance ${self.invoice.balance_due}"
                )
    
    def save(self, *args, **kwargs):
        self.clean()
        
        if self.idempotency_key and not self.pk:
            if Payment.objects.filter(idempotency_key=self.idempotency_key).exists():
                raise ValidationError(f'Duplicate payment: {self.idempotency_key}')
        
        with transaction.atomic():
            invoice_locked = Invoice.objects.select_for_update().get(pk=self.invoice_id)
            super().save(*args, **kwargs)
            invoice_locked.recalculate_totals()
    
    class Meta:
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['-payment_date']),
            models.Index(fields=['invoice', '-payment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['idempotency_key']),
        ]
```

### Fix 2: Clean Refund Model

**Separate refunds completely:**

```python
class Refund(models.Model):
    """
    Records money RETURNED to guests
    Completely separate from Payment
    """
    
    REFUND_STATUS_CHOICES = (
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("processed", "Processed/Completed"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    )
    
    REFUND_METHOD_CHOICES = (
        ('original_payment', 'Original Payment Method'),
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('store_credit', 'Store Credit'),
    )
    
    # Core relationships
    invoice = models.ForeignKey('pos.Invoice', on_delete=models.CASCADE, related_name='refunds')
    
    # Optional: Link to specific payment being refunded
    original_payment = models.ForeignKey(
        'pos.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refunds',
        help_text='The payment being refunded (if partial refund)'
    )
    
    # Refund details
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]  # MUST be positive
    )
    reason = models.TextField()
    refund_method = models.CharField(max_length=20, choices=REFUND_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=REFUND_STATUS_CHOICES, default="pending")
    
    # Transaction tracking
    transaction_id = models.CharField(max_length=100, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    
    # Approval workflow
    requested_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='refund_requests'
    )
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_approvals'
    )
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_processing'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    history = HistoricalRecords()
    
    def clean(self):
        """Validation"""
        if self.amount <= 0:
            raise ValidationError("Refund amount must be positive")
        
        # Can't refund more than invoice total paid
        if self.invoice:
            total_refunded = self.invoice.get_total_refunded(exclude_id=self.pk)
            if (total_refunded + self.amount) > self.invoice.amount_paid:
                raise ValidationError(
                    f"Total refunds (${total_refunded + self.amount}) "
                    f"cannot exceed amount paid (${self.invoice.amount_paid})"
                )
    
    def save(self, *args, **kwargs):
        self.clean()
        
        with transaction.atomic():
            invoice_locked = Invoice.objects.select_for_update().get(pk=self.invoice_id)
            super().save(*args, **kwargs)
            
            # Only recalculate if refund is processed
            if self.status == 'processed':
                invoice_locked.recalculate_totals()
    
    def approve(self, user):
        """Approve refund"""
        if self.status != 'pending':
            raise ValidationError("Only pending refunds can be approved")
        
        self.status = 'approved'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()
    
    def process(self, user, transaction_id='', reference=''):
        """Process refund"""
        if self.status not in ['pending', 'approved']:
            raise ValidationError("Only pending/approved refunds can be processed")
        
        self.status = 'processed'
        self.processed_by = user
        self.processed_at = timezone.now()
        self.transaction_id = transaction_id
        self.reference = reference
        self.save()
        
        # Update guest loyalty points
        self._update_guest_loyalty()
    
    def _update_guest_loyalty(self):
        """Deduct loyalty points when refund is processed"""
        guest = self.invoice.guest
        if hasattr(guest, 'loyalty_points'):
            points_to_deduct = int(self.amount)
            guest.loyalty_points = max(0, guest.loyalty_points - points_to_deduct)
            guest.total_spent = max(Decimal('0.00'), guest.total_spent - self.amount)
            guest.save(update_fields=['loyalty_points', 'total_spent'])
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice', '-created_at']),
            models.Index(fields=['status']),
        ]
```

### Fix 3: Improved Deposit Model

```python
class Deposit(models.Model):
    """
    Pre-payment collected before service
    Tracked separately until applied to invoice
    """
    
    DEPOSIT_STATUS = (
        ('pending', 'Pending Collection'),
        ('collected', 'Collected (Not Applied)'),
        ('partially_applied', 'Partially Applied'),
        ('fully_applied', 'Fully Applied'),
        ('refunded', 'Refunded'),
        ('expired', 'Expired'),
    )
    
    # Core relationships
    guest = models.ForeignKey('guests.Guest', on_delete=models.CASCADE, related_name='deposits')
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='deposits',
        null=True,
        blank=True
    )
    
    # Deposit tracking
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    amount_applied = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Amount already applied to invoices'
    )
    
    status = models.CharField(max_length=20, choices=DEPOSIT_STATUS, default='pending')
    
    # Payment details (how deposit was collected)
    payment_method = models.CharField(max_length=20)
    transaction_id = models.CharField(max_length=100, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    collected_at = models.DateTimeField(null=True, blank=True)
    collected_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collected_deposits'
    )
    
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date after which deposit expires if not used'
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    @property
    def remaining_amount(self):
        """Calculate remaining deposit balance"""
        return self.amount - self.amount_applied
    
    def can_be_applied(self):
        """Check if deposit can be applied"""
        return (
            self.status in ['collected', 'partially_applied'] and
            self.remaining_amount > 0 and
            (not self.expiry_date or timezone.now().date() <= self.expiry_date)
        )
    
    def apply_to_invoice(self, invoice, amount=None):
        """
        Apply deposit to an invoice
        Creates a Payment record linked to this deposit
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        
        if not self.can_be_applied():
            raise ValidationError("Deposit cannot be applied")
        
        # Default to full remaining amount
        if amount is None:
            amount = self.remaining_amount
        
        # Validate amount
        if amount <= 0:
            raise ValidationError("Application amount must be positive")
        
        if amount > self.remaining_amount:
            raise ValidationError(
                f"Cannot apply ${amount}, only ${self.remaining_amount} available"
            )
        
        if amount > invoice.balance_due:
            amount = invoice.balance_due
        
        with transaction.atomic():
            # Lock both records
            deposit_locked = Deposit.objects.select_for_update().get(pk=self.pk)
            invoice_locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
            
            # Create payment record
            payment = Payment.objects.create(
                invoice=invoice_locked,
                payment_method_id=1,  # Or get "Deposit" payment method
                amount=amount,
                payment_type='deposit_application',
                status='completed',
                deposit=deposit_locked,
                reference=f'Deposit #{deposit_locked.id}',
                notes=f'Applied from deposit collected on {deposit_locked.collected_at.strftime("%Y-%m-%d")}'
            )
            
            # Update deposit tracking
            deposit_locked.amount_applied += amount
            
            # Update status
            if deposit_locked.amount_applied >= deposit_locked.amount:
                deposit_locked.status = 'fully_applied'
            else:
                deposit_locked.status = 'partially_applied'
            
            deposit_locked.save(update_fields=['amount_applied', 'status'])
            
            return payment
    
    class Meta:
        ordering = ['-collected_at']
        verbose_name = 'Deposit'
        verbose_name_plural = 'Deposits'
        indexes = [
            models.Index(fields=['guest', '-collected_at']),
            models.Index(fields=['status']),
        ]
```

### Fix 4: Invoice Calculation Logic

```python
class Invoice(models.Model):
    # ... existing fields ...
    
    def get_total_paid(self):
        """
        Calculate total money received
        Only counts completed positive payments
        """
        total = self.payments.filter(
            status='completed'
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        return total
    
    def get_total_refunded(self, exclude_id=None):
        """
        Calculate total money refunded
        Only counts processed refunds
        """
        qs = self.refunds.filter(status='processed')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    
    def get_net_paid(self):
        """
        Net amount: Payments - Refunds
        This is what guest has actually paid after refunds
        """
        return self.get_total_paid() - self.get_total_refunded()
    
    def recalculate_totals(self):
        """
        Recalculate all invoice financial fields
        """
        from django.db import transaction
        
        with transaction.atomic():
            locked = Invoice.objects.select_for_update().get(pk=self.pk)
            
            # 1. Calculate subtotal from items
            subtotal = sum(
                item.unit_price * item.quantity 
                for item in locked.items.all()
            )
            locked.subtotal = subtotal
            
            # 2. Get POS configuration
            cfg = PosConfig.objects.first()
            
            # 3. Service charge
            service_charge = Decimal("0.00")
            if cfg and cfg.service_charge_rate:
                service_charge = (subtotal * cfg.service_charge_rate / Decimal("100"))
            locked.service_charge = service_charge
            
            # 4. Calculate tax
            item_tax = sum(
                (item.unit_price * item.quantity * item.tax_rate / Decimal("100"))
                for item in locked.items.all()
            )
            vat_total = Decimal("0.00")
            if cfg and cfg.vat_rate:
                vat_total = (subtotal + service_charge) * cfg.vat_rate / Decimal("100")
            locked.tax = item_tax + vat_total
            
            # 5. Calculate total
            locked.total = subtotal + service_charge + locked.tax - (locked.discount or Decimal('0.00'))
            
            # 6. Calculate net paid (payments - refunds)
            locked.amount_paid = locked.get_net_paid()
            
            # 7. Balance
            locked.balance_due = locked.total - locked.amount_paid
            
            # 8. Update status
            if locked.balance_due <= Decimal('0.00') and locked.total > Decimal('0.00'):
                locked.status = 'paid'
                if not locked.paid_date:
                    locked.paid_date = timezone.now()
            elif locked.balance_due >= locked.total:
                # No net payment
                if locked.status not in ['draft', 'cancelled', 'refunded']:
                    if locked.due_date and timezone.now().date() > locked.due_date:
                        locked.status = 'overdue'
                    else:
                        locked.status = 'issued'
            else:
                # Partial payment
                locked.status = 'partial'
            
            # 9. Save with version bump
            locked.version = (locked.version or 0) + 1
            locked.save(update_fields=[
                'subtotal', 'tax', 'service_charge', 'total',
                'amount_paid', 'balance_due', 'status', 'paid_date', 'version'
            ])
            
            # Sync to current instance
            for f in ['subtotal', 'tax', 'service_charge', 'total', 
                      'amount_paid', 'balance_due', 'status', 'paid_date', 'version']:
                setattr(self, f, getattr(locked, f))
    
    def get_payment_summary(self):
        """Enhanced payment summary"""
        return {
            'total_payments': self.payments.filter(status='completed').count(),
            'total_paid': str(self.get_total_paid()),
            'total_refunded': str(self.get_total_refunded()),
            'net_paid': str(self.get_net_paid()),
            'payment_methods': list(
                self.payments.filter(status='completed')
                .values_list('payment_method__name', flat=True)
                .distinct()
            ),
        }
```

---

## 🔄 Migration Guide

### Step 1: Data Migration

```python
# migrations/0XXX_cleanup_payments_refunds.py

from django.db import migrations
from decimal import Decimal

def cleanup_refund_data(apps, schema_editor):
    """
    Convert negative payments to Refund records
    """
    Payment = apps.get_model('pos', 'Payment')
    Refund = apps.get_model('pos', 'Refund')
    
    # Find all negative/refund payments
    refund_payments = Payment.objects.filter(
        models.Q(amount__lt=0) | models.Q(payment_type='refund')
    )
    
    for payment in refund_payments:
        # Create proper Refund record
        Refund.objects.create(
            invoice=payment.invoice,
            original_payment=None,  # Can't determine from negative payment
            amount=abs(payment.amount),
            reason=payment.notes or 'Migrated from legacy refund payment',
            refund_method='original_payment',
            status='processed',
            requested_by=payment.processed_by,
            processed_by=payment.processed_by,
            processed_at=payment.payment_date,
            transaction_id=payment.transaction_id,
            reference=payment.reference,
            notes=f'Migrated from Payment #{payment.id}'
        )
    
    # Delete negative payments
    refund_payments.delete()

class Migration(migrations.Migration):
    dependencies = [
        ('pos', '0XXX_previous_migration'),
    ]
    
    operations = [
        migrations.RunPython(cleanup_refund_data, reverse_code=migrations.RunPython.noop),
    ]
```

### Step 2: Update API Views

See the complete updated views in the next section...

---

## 📊 Testing Scenarios

### Test Case 1: Simple Payment
```python
invoice = Invoice.objects.create(guest=guest, total=100)
payment = Payment.objects.create(
    invoice=invoice,
    amount=100,
    status='completed'
)
assert invoice.balance_due == 0
assert invoice.status == 'paid'
```

### Test Case 2: Partial Refund
```python
refund = Refund.objects.create(
    invoice=invoice,
    amount=50,
    reason='Partial refund'
)
refund.process(user=admin)
assert invoice.get_net_paid() == 50
assert invoice.balance_due == 50
assert invoice.status == 'partial'
```

### Test Case 3: Deposit Application
```python
deposit = Deposit.objects.create(
    guest=guest,
    amount=50,
    status='collected'
)
payment = deposit.apply_to_invoice(invoice, amount=50)
assert deposit.remaining_amount == 0
assert invoice.balance_due == 50
```

---

## 🎯 Key Benefits

1. ✅ **Clear Separation**: Payments (in) vs Refunds (out)
2. ✅ **Audit Trail**: Every money movement is tracked
3. ✅ **No Negative Amounts**: All amounts are positive
4. ✅ **Deposit Clarity**: Collected → Applied flow is explicit
5. ✅ **Concurrency Safe**: Proper locking everywhere
6. ✅ **Single Source of Truth**: Each model has one purpose

---

## 📞 Next Steps

1. Review this architecture
2. Run data migration
3. Update serializers & views
4. Add comprehensive tests
5. Update frontend to match new API

