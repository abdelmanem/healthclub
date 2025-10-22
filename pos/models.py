
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q, Max
from simple_history.models import HistoricalRecords
import uuid


class PosConfig(models.Model):
    """
    Global POS configuration settings
    
    Fields:
    - vat_rate: VAT percentage applied to invoices
    - service_charge_rate: Service charge percentage
    """
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="VAT rate percentage (e.g., 15.00 for 15%)"
    )
    
    service_charge_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Service charge percentage (e.g., 10.00 for 10%)"
    )
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = 'POS configuration'
        verbose_name_plural = 'POS configuration'

    def __str__(self) -> str:
        return f"VAT {self.vat_rate}% / Service {self.service_charge_rate}%"


class PaymentMethod(models.Model):
    """
    Defines available payment methods in the spa
    
    Examples:
    - Cash (requires no reference)
    - Credit Card (requires transaction ID)
    - Mobile Payment (requires reference number)
    - Gift Card (requires card number)
    """
    
    name = models.CharField(
        max_length=50,
        help_text="Display name for this payment method (e.g., 'Credit Card')"
    )
    
    code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Internal code (e.g., 'credit_card'). Used in API calls."
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="If unchecked, this method won't appear in payment options"
    )
    
    requires_reference = models.BooleanField(
        default=False,
        help_text="If checked, staff must enter a transaction/reference number"
    )
    
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text="Emoji or CSS icon class (e.g., '💳' or 'fas fa-credit-card')"
    )
    
    display_order = models.IntegerField(
        default=0,
        help_text="Sort order (lower numbers appear first)"
    )
    
    description = models.TextField(
        blank=True,
        help_text="Internal notes about this payment method"
    )
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = "Payment Method"
        verbose_name_plural = "Payment Methods"
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.name
    
    def clean(self):
        """Validation before saving"""
        if self.code:
            self.code = self.code.lower().replace(' ', '_')


class Invoice(models.Model):
    """
    Main invoice/bill for spa services
    
    Lifecycle:
    1. draft → Being created, not finalized
    2. issued → Finalized, awaiting payment
    3. partial → Some payment received, balance remains
    4. paid → Fully paid
    5. overdue → Past due date, not paid
    6. cancelled → Cancelled before payment
    7. refunded → Payment returned to guest
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
        help_text="Auto-generated unique invoice number (e.g., INV-1-20251010)"
    )
    
    # Dates
    date = models.DateTimeField(
        auto_now_add=True,
        help_text="When invoice was created"
    )
    
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Payment due by this date"
    )
    
    # Financial fields
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Sum of all line items before tax and discount"
    )
    
    tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total tax amount (item tax + VAT)"
    )
    
    service_charge = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Service charge amount"
    )
    
    discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Discount amount (promotional, membership, etc.)"
    )
    
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Final amount: (subtotal + service_charge + tax - discount)"
    )
    
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total amount paid so far"
    )
    
    balance_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Remaining balance: (total - amount_paid)"
    )

    # Version for optimistic locking (Phase 1)
    version = models.IntegerField(
        default=0,
        help_text='Version number for optimistic locking'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        help_text="Current invoice status"
    )
    
    paid_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When invoice was fully paid"
    )
    
    # Additional info
    notes = models.TextField(
        blank=True,
        help_text="Internal notes (guest requests, special circumstances, etc.)"
    )
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_invoices',
        help_text="Staff member who created this invoice"
    )
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-date']
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"
        indexes = [
            models.Index(fields=['-date']),
            models.Index(fields=['guest', '-date']),
            models.Index(fields=['status']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['reservation']),
            models.Index(fields=['status', 'balance_due'], name='invoice_status_balance_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Invoice {self.invoice_number}"
    
    @staticmethod
    def generate_invoice_number() -> str:
        """
        Generate next sequential invoice number
        Format: INV-<pk+1>-<YYYYMMDDHHMM>
        """
        timestamp = timezone.now().strftime("%Y%m%d%H%M")
        last = Invoice.objects.order_by("-id").first()
        base = (last.id + 1) if last else 1
        return f"INV-{base}-{timestamp}"
    
    def recalculate_totals(self) -> None:
        """
        Recalculate all invoice financial fields
        
        Steps:
        1. Sum all invoice items → subtotal
        2. Apply service charge (from config)
        3. Calculate item-level tax + VAT
        4. Apply discount
        5. Calculate total
        6. Sum all completed payments → amount_paid
        7. Calculate balance = total - amount_paid
        8. Update status based on balance
        """
        
        from django.db import transaction
        # Perform calculations inside a transaction and lock this invoice row
        with transaction.atomic():
            locked = Invoice.objects.select_for_update().get(pk=self.pk)

            # Calculate subtotal from items
            subtotal = Decimal("0.00")
            for item in locked.items.all():
                line_subtotal = item.unit_price * item.quantity
                subtotal += line_subtotal
            locked.subtotal = subtotal

            # Get POS configuration
            cfg = PosConfig.objects.first()

            # Service charge (percentage of subtotal)
            service_charge = Decimal("0.00")
            if cfg and cfg.service_charge_rate:
                service_charge = (subtotal * (cfg.service_charge_rate / Decimal("100")))
            locked.service_charge = service_charge

            # Calculate tax: item-level tax + VAT on (subtotal + service charge)
            item_tax = Decimal("0.00")
            for item in locked.items.all():
                if item.tax_rate:
                    item_tax += (item.unit_price * item.quantity) * (item.tax_rate / Decimal("100"))
            vat_total = Decimal("0.00")
            if cfg and cfg.vat_rate:
                vat_total = (subtotal + service_charge) * (cfg.vat_rate / Decimal("100"))
            locked.tax = item_tax + vat_total

            # Calculate total
            locked.total = subtotal + service_charge + locked.tax - (locked.discount or Decimal('0.00'))

            # Amount paid = payments (completed) - refunds (processed)
            locked.amount_paid = (locked.payments.filter(status='completed')
                                   .aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00'))
            locked.amount_paid -= (locked.refunds.filter(status='processed')
                                   .aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00'))

            # Balance
            locked.balance_due = locked.total - locked.amount_paid

            # Status update
            if locked.balance_due <= Decimal('0.00') and locked.total > Decimal('0.00'):
                locked.status = self.STATUS_PAID
                if not locked.paid_date:
                    locked.paid_date = timezone.now()
            elif locked.amount_paid > Decimal('0.00') and locked.balance_due > Decimal('0.00'):
                locked.status = self.STATUS_PARTIAL
            elif locked.amount_paid == Decimal('0.00'):
                if locked.status not in [self.STATUS_DRAFT, self.STATUS_CANCELLED, self.STATUS_REFUNDED]:
                    if locked.due_date and timezone.now().date() > locked.due_date:
                        locked.status = self.STATUS_OVERDUE
                    else:
                        locked.status = self.STATUS_ISSUED

            # Save updated fields and bump version
            locked.version = (locked.version or 0) + 1
            locked.save(update_fields=[
                'subtotal', 'tax', 'service_charge', 'total',
                'amount_paid', 'balance_due', 'status', 'paid_date', 'version'
            ])

            # Sync current instance fields to reflect latest values
            for f in ['subtotal','tax','service_charge','total','amount_paid','balance_due','status','paid_date','version']:
                setattr(self, f, getattr(locked, f))
    
    def save(self, *args, **kwargs):
        """Override save to handle auto-generation"""
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        
        if not self.due_date:
            self.due_date = timezone.now().date()
        
        super().save(*args, **kwargs)
    
    def can_be_paid(self):
        """Check if invoice can accept payments"""
        return self.status not in [self.STATUS_CANCELLED, self.STATUS_REFUNDED] and self.balance_due > 0
    
    def can_be_refunded(self):
        """Check if invoice can be refunded"""
        return self.amount_paid > 0 and self.status != self.STATUS_CANCELLED
    
    def get_payment_summary(self):
        """Get payment breakdown for display (refunds counted from Refund model only)"""
        completed_payments = self.payments.filter(status='completed')
        refunds_sum = self.refunds.filter(status='processed').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        return {
            'total_payments': completed_payments.count(),
            'payment_methods': list(
                completed_payments.values_list('method', flat=True).distinct()
            ),
            'refund_amount': refunds_sum,
        }

    # POS.md helpers
    def get_total_paid(self):
        return self.payments.filter(status='completed').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

    def get_total_refunded(self, exclude_id=None):
        qs = self.refunds.filter(status='processed')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

    def get_net_paid(self):
        return self.get_total_paid() - self.get_total_refunded()


class InvoiceItem(models.Model):
    """
    Individual line item on an invoice
    
    Examples:
    - Swedish Massage (60 min) - Qty: 1 - $80.00
    - Aromatherapy Add-on - Qty: 1 - $20.00
    """
    
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Parent invoice"
    )
    
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_items',
        help_text="Link to service (optional, for reporting)"
    )
    
    product_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Description shown on invoice"
    )
    
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Number of units"
    )
    
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Price per unit (before tax)"
    )
    
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[
            MinValueValidator(Decimal('0.00')),
            MaxValueValidator(Decimal('100.00'))
        ],
        help_text="Tax percentage (e.g., 8.00 for 8%)"
    )
    
    notes = models.TextField(
        blank=True,
        help_text="Line item notes"
    )
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['id']
        verbose_name = 'Invoice item'
        verbose_name_plural = 'Invoice items'
    
    def __str__(self) -> str:
        if self.service:
            return f"{self.service.name} x{self.quantity}"
        return f"{self.product_name} x{self.quantity}"
    
    @property
    def line_total(self):
        """Calculate line total"""
        return self.unit_price * self.quantity
    
    def save(self, *args, **kwargs):
        """Save and trigger invoice recalculation"""
        super().save(*args, **kwargs)
        
        if self.invoice_id:
            self.invoice.recalculate_totals()
    
    def delete(self, *args, **kwargs):
        """Recalculate invoice totals after deletion"""
        invoice = self.invoice
        super().delete(*args, **kwargs)
        if invoice:
            invoice.recalculate_totals()
    
    def get_tax_amount(self):
        """Calculate tax for this line item"""
        return (self.unit_price * self.quantity * self.tax_rate / 100).quantize(
            Decimal('0.01')
        )
    
    def get_total_with_tax(self):
        """Get line total including tax"""
        return self.line_total + self.get_tax_amount()


class Payment(models.Model):
    """
    Records money RECEIVED from guests.
    ONLY positive amounts. Refunds are tracked in `Refund`.
    """
    
    METHOD_CASH = 'cash'
    METHOD_CARD = 'card'
    METHOD_WALLET = 'wallet'
    METHOD_STRIPE = 'stripe'
    METHOD_PAYPAL = 'paypal'
    METHOD_GIFT_CARD = 'gift_card'
    METHOD_DEPOSIT = 'deposit'
    METHOD_STORE_CREDIT = 'store_credit'
    
    METHOD_CHOICES = (
        (METHOD_CASH, 'Cash'),
        (METHOD_CARD, 'Card'),
        (METHOD_WALLET, 'Wallet'),
        (METHOD_STRIPE, 'Stripe'),
        (METHOD_PAYPAL, 'PayPal'),
        (METHOD_GIFT_CARD, 'Gift Card'),
        (METHOD_DEPOSIT, 'Deposit'),
        (METHOD_STORE_CREDIT, 'Store Credit'),
    )
    
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
    
    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='payments',
        help_text="Invoice being paid"
    )
    
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Link to payment method record"
    )
    
    method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        help_text="Payment method"
    )
    
    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPE_CHOICES,
        default='regular',
        help_text="Type of payment"
    )
    
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Payment amount (must be positive)"
    )
    
    transaction_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Processor transaction ID"
    )
    
    reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Additional reference (check #, last 4 digits, etc.)"
    )
    
    payment_date = models.DateTimeField(
        auto_now_add=True,
        help_text="When payment was received"
    )
    
    status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="completed",
        db_index=True,
        help_text="Payment status"
    )
    
    processing_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Processing/gateway fee"
    )
    
    gateway_response = models.JSONField(
        default=dict,
        blank=True,
        help_text="Response from payment gateway"
    )
    
    notes = models.TextField(
        blank=True,
        help_text="Payment notes"
    )

    idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Unique key to prevent duplicate payment processing'
    )
    
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Staff member who processed this payment"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-payment_date']
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        indexes = [
            models.Index(fields=['-payment_date']),
            models.Index(fields=['invoice', '-payment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['method']),
            models.Index(fields=['idempotency_key']),
        ]
    
    def __str__(self) -> str:
        return f"Payment {self.amount} {self.method} for {self.invoice}"
    
    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Payment amount must be positive")
        
        if not self.pk and self.status == 'completed':
            if self.amount > self.invoice.balance_due:
                raise ValidationError(
                    f"Payment amount ${self.amount} exceeds balance due ${self.invoice.balance_due}"
                )
    
    def save(self, *args, **kwargs):
        from django.db import transaction
        self.clean()

        if self.idempotency_key and not self.pk:
            if Payment.objects.filter(idempotency_key=self.idempotency_key).exists():
                raise ValidationError(f'Payment with idempotency key {self.idempotency_key} already exists')

        with transaction.atomic():
            invoice_locked = Invoice.objects.select_for_update().get(pk=self.invoice_id)
            super().save(*args, **kwargs)
            invoice_locked.recalculate_totals()

            if self.status == 'completed':
                guest = invoice_locked.guest
                try:
                    from guests.models import Guest
                    guest_locked = Guest.objects.select_for_update().get(pk=guest.pk)
                except Exception:
                    guest_locked = guest

                if hasattr(guest_locked, 'loyalty_points') and hasattr(guest_locked, 'total_spent'):
                    points_change = int(self.amount)
                    spending_change = self.amount

                    guest_locked.loyalty_points = max(0, (guest_locked.loyalty_points or 0) + points_change)
                    guest_locked.total_spent = max(
                        Decimal('0.00'),
                        (guest_locked.total_spent or Decimal('0.00')) + spending_change
                    )
                    guest_locked.save(update_fields=['loyalty_points', 'total_spent'])
    
    def get_display_amount(self):
        return f"${self.amount:.2f}"
    
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
                    f"Total refunds (${total_refunded + self.amount}) cannot exceed amount paid (${self.invoice.amount_paid})"
                )
    
    def save(self, *args, **kwargs):
        from django.db import transaction
        self.clean()
        
        with transaction.atomic():
            invoice_locked = Invoice.objects.select_for_update().get(pk=self.invoice_id)
            super().save(*args, **kwargs)
            
            if self.status == 'processed':
                invoice_locked.recalculate_totals()
                self._update_guest_loyalty()
    
    def approve(self, user):
        if self.status != 'pending':
            raise ValidationError("Only pending refunds can be approved")
        self.status = 'approved'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()
    
    def process(self, user, transaction_id='', reference=''):
        if self.status not in ['pending', 'approved']:
            raise ValidationError("Only pending/approved refunds can be processed")
        self.status = 'processed'
        self.processed_by = user
        self.processed_at = timezone.now()
        self.transaction_id = transaction_id
        self.reference = reference
        self.save()
    
    def _update_guest_loyalty(self):
        guest = self.invoice.guest
        if hasattr(guest, 'loyalty_points'):
            points_to_deduct = int(self.amount)
            guest.loyalty_points = max(0, guest.loyalty_points - points_to_deduct)
            guest.total_spent = max(Decimal('0.00'), guest.total_spent - self.amount)
            guest.save(update_fields=['loyalty_points', 'total_spent'])


class GiftCard(models.Model):
    """Model to manage gift cards and store credits"""
    STATUS_CHOICES = (
        ("active", "Active"),
        ("used", "Used"),
        ("expired", "Expired"),
        ("cancelled", "Cancelled"),
    )

    code = models.CharField(max_length=50, unique=True)
    
    guest = models.ForeignKey(
        'guests.Guest',
        on_delete=models.CASCADE,
        related_name='gift_cards',
        null=True,
        blank=True
    )
    
    original_amount = models.DecimalField(max_digits=10, decimal_places=2)
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active"
    )
    
    issued_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    
    issued_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    notes = models.TextField(blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-issued_date']

    def __str__(self) -> str:
        return f"Gift Card {self.code} - ${self.remaining_amount}"
    
    def use_amount(self, amount):
        """Use a specific amount from the gift card"""
        if amount > self.remaining_amount:
            raise ValueError("Amount exceeds remaining balance")
        
        self.remaining_amount -= amount
        if self.remaining_amount <= 0:
            self.status = "used"
        self.save()


class PromotionalCode(models.Model):
    """Model to manage promotional codes and discounts"""
    CODE_TYPES = (
        ("percentage", "Percentage"),
        ("fixed_amount", "Fixed Amount"),
        ("free_service", "Free Service"),
    )

    code = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=200)
    code_type = models.CharField(max_length=20, choices=CODE_TYPES)
    
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Discount amount or percentage"
    )
    
    min_purchase_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    usage_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum number of uses"
    )
    
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    
    applicable_services = models.ManyToManyField(
        'services.Service',
        blank=True,
        help_text="Services this code applies to (leave empty for all services)"
    )
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-valid_from']

    def __str__(self) -> str:
        return f"{self.code} - {self.description}"
    
    def is_valid(self):
        """Check if the promotional code is valid"""
        now = timezone.now()
        return (
            self.is_active and
            self.valid_from <= now <= self.valid_until and
            (self.usage_limit is None or self.used_count < self.usage_limit)
        )
    
    def apply_discount(self, amount):
        """Apply discount to an amount"""
        if not self.is_valid():
            return 0
        
        if self.code_type == "percentage":
            discount = (amount * self.discount_value) / 100
            if self.max_discount_amount:
                discount = min(discount, self.max_discount_amount)
        elif self.code_type == "fixed_amount":
            discount = min(self.discount_value, amount)
        else:
            discount = 0
        
        return discount


class FinancialReport(models.Model):
    """Model to store generated financial reports"""
    REPORT_TYPES = (
        ("revenue", "Revenue Report"),
        ("profit_loss", "Profit & Loss"),
        ("tax_summary", "Tax Summary"),
        ("payment_summary", "Payment Summary"),
        ("custom", "Custom Report"),
    )

    name = models.CharField(max_length=200)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    
    generated_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    generated_at = models.DateTimeField(auto_now_add=True)
    
    data = models.JSONField(
        default=dict,
        help_text="Report data in JSON format"
    )
    
    file_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="Path to generated report file"
    )
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-generated_at']

    def __str__(self) -> str:
        return f"{self.name} - {self.get_report_type_display()}"


# Signal handlers for automatic updates
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


@receiver(post_delete, sender=InvoiceItem)
def recalculate_invoice_on_item_delete(sender, instance, **kwargs):
    """Recalculate invoice when item is deleted"""
    if instance.invoice_id:
        try:
            invoice = Invoice.objects.get(id=instance.invoice_id)
            invoice.recalculate_totals()
        except Invoice.DoesNotExist:
            pass


# NOTE: Recalculation is now handled within Payment.save() with proper locking.
# The signal below is intentionally disabled to avoid double recalculation.
# @receiver(post_save, sender=Payment)
# def update_invoice_on_payment_save(sender, instance, created, **kwargs):
#     """Update invoice totals when payment is saved"""
#     if instance.invoice_id:
#         # Prevent recursive calls by checking if we're already in recalculation
#         if not hasattr(instance, '_recalculating'):
#             instance._recalculating = True
#             try:
#                 instance.invoice.recalculate_totals()
#             finally:
#                 delattr(instance, '_recalculating')


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
        return self.amount - self.amount_applied
    
    def can_be_applied(self):
        return (
            self.status in ['collected', 'partially_applied'] and
            self.remaining_amount > 0 and
            (not self.expiry_date or timezone.now().date() <= self.expiry_date)
        )
    
    def apply_to_invoice(self, invoice, amount=None):
        from django.db import transaction
        from django.core.exceptions import ValidationError
        
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
            deposit_locked = Deposit.objects.select_for_update().get(pk=self.pk)
            invoice_locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
            
            # Attempt to find/create a PaymentMethod for deposits
            payment_method_obj = None
            try:
                payment_method_obj = PaymentMethod.objects.get(code='deposit')
            except Exception:
                payment_method_obj = None
            
            payment = Payment.objects.create(
                invoice=invoice_locked,
                method='deposit',
                payment_method=payment_method_obj,
                payment_type='deposit_application',
                amount=amount,
                status='completed',
                reference=f'Deposit #{deposit_locked.id}',
                notes=f'Applied from deposit collected on {deposit_locked.collected_at.strftime("%Y-%m-%d") if deposit_locked.collected_at else ""}'
            )
            
            deposit_locked.amount_applied += amount
            if deposit_locked.amount_applied >= deposit_locked.amount:
                deposit_locked.status = 'fully_applied'
            else:
                deposit_locked.status = 'partially_applied'
            deposit_locked.save(update_fields=['amount_applied', 'status'])
            
            return payment