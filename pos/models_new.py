"""
New POS Models with Clean Architecture
Based on POS.md analysis and recommendations
"""

from django.db import models, transaction
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from simple_history.models import HistoricalRecords


class PaymentMethod(models.Model):
    """Payment methods available in the system"""
    
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    requires_processing = models.BooleanField(default=False)
    processing_fee_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Processing fee percentage"
    )
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    def clean(self):
        if self.code:
            self.code = self.code.lower().replace(' ', '_')


class Invoice(models.Model):
    """
    Main invoice/bill for spa services
    Clean separation of concerns
    """
    
    STATUS_DRAFT = 'draft'
    STATUS_ISSUED = 'issued'
    STATUS_PARTIAL = 'partial'
    STATUS_PAID = 'paid'
    STATUS_OVERDUE = 'overdue'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ISSUED, 'Issued'),
        (STATUS_PARTIAL, 'Partially Paid'),
        (STATUS_PAID, 'Paid'),
        (STATUS_OVERDUE, 'Overdue'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_REFUNDED, 'Refunded'),
    ]
    
    # Relationships
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='invoices',
        help_text="The guest being billed"
    )
    
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='invoices',
        null=True,
        blank=True,
        help_text="Related reservation (if any)"
    )
    
    # Unique identifier
    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        db_index=True,
        help_text="Auto-generated unique invoice number"
    )
    
    # Dates
    date = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    
    # Financial fields
    subtotal = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Subtotal before tax and service charge"
    )
    service_charge = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Service charge amount"
    )
    tax = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Total tax amount"
    )
    discount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Discount amount"
    )
    total = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Total amount due"
    )
    amount_paid = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Total amount paid (net of refunds)"
    )
    balance_due = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Outstanding balance"
    )
    
    # Status
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT,
        db_index=True
    )
    paid_date = models.DateTimeField(null=True, blank=True)
    
    # Additional info
    notes = models.TextField(blank=True)
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_invoices'
    )
    
    # Version for optimistic locking
    version = models.PositiveIntegerField(default=0)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['-date']),
            models.Index(fields=['guest', '-date']),
            models.Index(fields=['status']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['reservation']),
        ]
    
    def __str__(self):
        return f"Invoice {self.invoice_number}"
    
    @staticmethod
    def generate_invoice_number():
        """Generate next sequential invoice number"""
        timestamp = timezone.now().strftime("%Y%m%d%H%M")
        last = Invoice.objects.order_by("-id").first()
        base = (last.id + 1) if last else 1
        return f"INV-{base}-{timestamp}"
    
    def get_total_paid(self):
        """Calculate total money received (only positive payments)"""
        total = self.payments.filter(
            status='completed'
        ).aggregate(models.Sum('amount'))['amount__sum'] or Decimal('0.00')
        return total
    
    def get_total_refunded(self, exclude_id=None):
        """Calculate total money refunded (only processed refunds)"""
        qs = self.refunds.filter(status='processed')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.aggregate(models.Sum('amount'))['amount__sum'] or Decimal('0.00')
    
    def get_net_paid(self):
        """Net amount: Payments - Refunds"""
        return self.get_total_paid() - self.get_total_refunded()
    
    def recalculate_totals(self):
        """Recalculate all invoice financial fields"""
        with transaction.atomic():
            locked = Invoice.objects.select_for_update().get(pk=self.pk)
            
            # 1. Calculate subtotal from items
            subtotal = sum(
                item.unit_price * item.quantity 
                for item in locked.items.all()
            )
            locked.subtotal = subtotal
            
            # 2. Calculate tax from items
            item_tax = sum(
                (item.unit_price * item.quantity * item.tax_rate / Decimal("100"))
                for item in locked.items.all()
            )
            locked.tax = item_tax
            
            # 3. Calculate total
            locked.total = subtotal + locked.service_charge + locked.tax - (locked.discount or Decimal('0.00'))
            
            # 4. Calculate net paid (payments - refunds)
            locked.amount_paid = locked.get_net_paid()
            
            # 5. Balance
            locked.balance_due = locked.total - locked.amount_paid
            
            # 6. Update status
            if locked.balance_due <= Decimal('0.00') and locked.total > Decimal('0.00'):
                locked.status = 'paid'
                if not locked.paid_date:
                    locked.paid_date = timezone.now()
            elif locked.balance_due >= locked.total:
                if locked.status not in ['draft', 'cancelled', 'refunded']:
                    if locked.due_date and timezone.now().date() > locked.due_date:
                        locked.status = 'overdue'
                    else:
                        locked.status = 'issued'
            else:
                locked.status = 'partial'
            
            # 7. Save with version bump
            locked.version = (locked.version or 0) + 1
            locked.save(update_fields=[
                'subtotal', 'tax', 'total', 'amount_paid', 'balance_due', 
                'status', 'paid_date', 'version'
            ])
            
            # Sync to current instance
            for f in ['subtotal', 'tax', 'total', 'amount_paid', 'balance_due', 
                      'status', 'paid_date', 'version']:
                setattr(self, f, getattr(locked, f))


class InvoiceItem(models.Model):
    """Individual line item on an invoice"""
    
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='items'
    )
    
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_items'
    )
    
    product_name = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    notes = models.TextField(blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['id']
    
    def __str__(self):
        if self.service:
            return f"{self.service.name} x{self.quantity}"
        return f"{self.product_name} x{self.quantity}"
    
    @property
    def line_total(self):
        return self.unit_price * self.quantity
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.invoice_id:
            self.invoice.recalculate_totals()
    
    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        if invoice:
            invoice.recalculate_totals()


class Payment(models.Model):
    """
    Records money RECEIVED from guests
    ONLY positive amounts - no negative payments
    """
    
    PAYMENT_STATUS_CHOICES = (
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    )
    
    PAYMENT_TYPE_CHOICES = (
        ('regular', 'Regular Payment'),
        ('deposit_application', 'Deposit Application'),
        ('manual', 'Manual Adjustment'),
    )
    
    # Core relationships
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='payments'
    )
    
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        related_name='payments'
    )
    
    # Payment details - ONLY positive amounts
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Payment amount (MUST be positive)"
    )
    
    payment_type = models.CharField(
        max_length=20, choices=PAYMENT_TYPE_CHOICES, default='regular'
    )
    
    status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, default="completed"
    )
    
    # Link to deposit if this payment came from applying a deposit
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
    
    # Idempotency for duplicate prevention
    idempotency_key = models.CharField(
        max_length=100, unique=True, null=True, blank=True, db_index=True
    )
    
    # Timestamps
    payment_date = models.DateTimeField(auto_now_add=True)
    
    # Metadata
    notes = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_payments'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['-payment_date']),
            models.Index(fields=['invoice', '-payment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['idempotency_key']),
        ]
    
    def __str__(self):
        return f"Payment ${self.amount} for {self.invoice.invoice_number}"
    
    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Payment amount must be positive")
        
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
            
            if self.status == 'completed':
                self._update_guest_loyalty()
    
    def _update_guest_loyalty(self):
        """Update guest loyalty points when payment is completed"""
        guest = self.invoice.guest
        if hasattr(guest, 'loyalty_points'):
            points_to_add = int(self.amount)
            guest.loyalty_points = (guest.loyalty_points or 0) + points_to_add
            guest.total_spent = (guest.total_spent or Decimal('0.00')) + self.amount
            guest.save(update_fields=['loyalty_points', 'total_spent'])


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
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    
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
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Refund amount (MUST be positive)"
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
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice', '-created_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Refund ${self.amount} for {self.invoice.invoice_number}"
    
    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Refund amount must be positive")
        
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
            
            if self.status == 'processed':
                invoice_locked.recalculate_totals()
                self._update_guest_loyalty()
    
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
    
    def _update_guest_loyalty(self):
        """Deduct loyalty points when refund is processed"""
        guest = self.invoice.guest
        if hasattr(guest, 'loyalty_points'):
            points_to_deduct = int(self.amount)
            guest.loyalty_points = max(0, guest.loyalty_points - points_to_deduct)
            guest.total_spent = max(Decimal('0.00'), guest.total_spent - self.amount)
            guest.save(update_fields=['loyalty_points', 'total_spent'])


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
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='deposits'
    )
    reservation = models.ForeignKey(
        'reservations.Reservation',
        on_delete=models.CASCADE,
        related_name='deposits',
        null=True,
        blank=True
    )
    
    # Deposit tracking
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    amount_applied = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
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
        null=True, blank=True,
        help_text='Date after which deposit expires if not used'
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-collected_at']
        indexes = [
            models.Index(fields=['guest', '-collected_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Deposit ${self.amount} for {self.guest}"
    
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
        if not self.can_be_applied():
            raise ValidationError("Deposit cannot be applied")
        
        if amount is None:
            amount = self.remaining_amount
        
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
