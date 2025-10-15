
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
    
    created_at = models.DateTimeField(auto_now_add=True)
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

            # Amount paid from completed payments only
            payments_data = locked.payments.filter(status='completed').aggregate(Sum('amount'))
            locked.amount_paid = payments_data['amount__sum'] or Decimal('0.00')

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
        """Get payment breakdown for display"""
        completed_payments = self.payments.filter(status='completed')
        
        # Calculate refund amount from both refunds table and negative refund payments
        refund_amount = Decimal('0.00')
        
        # Add refunds from refunds table
        refunds_sum = self.refunds.filter(status='processed').aggregate(Sum('amount'))['amount__sum']
        if refunds_sum:
            refund_amount += refunds_sum
        
        # Add negative payments with payment_type='refund'
        refund_payments_sum = self.payments.filter(
            status='completed',
            payment_type='refund',
            amount__lt=0
        ).aggregate(Sum('amount'))['amount__sum']
        if refund_payments_sum:
            refund_amount += abs(refund_payments_sum)  # Convert negative to positive for display
        
        return {
            'total_payments': completed_payments.count(),
            'payment_methods': list(
                completed_payments.values_list('method', flat=True).distinct()
            ),
            'refund_amount': refund_amount,
        }


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
    Record of money received (or refunded)
    
    Payment Types:
    - full: Complete payment of balance
    - partial: Partial payment (more payments expected)
    - deposit: Upfront payment (usually at booking)
    - refund: Money returned to guest (negative amount)
    """
    
    METHOD_CASH = 'cash'
    METHOD_CARD = 'card'
    METHOD_WALLET = 'wallet'
    METHOD_STRIPE = 'stripe'
    METHOD_PAYPAL = 'paypal'
    METHOD_GIFT_CARD = 'gift_card'
    METHOD_STORE_CREDIT = 'store_credit'
    
    METHOD_CHOICES = (
        (METHOD_CASH, 'Cash'),
        (METHOD_CARD, 'Card'),
        (METHOD_WALLET, 'Wallet'),
        (METHOD_STRIPE, 'Stripe'),
        (METHOD_PAYPAL, 'PayPal'),
        (METHOD_GIFT_CARD, 'Gift Card'),
        (METHOD_STORE_CREDIT, 'Store Credit'),
    )
    
    PAYMENT_STATUS_CHOICES = (
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
        ("cancelled", "Cancelled"),
    )
    
    PAYMENT_TYPE_CHOICES = [
        ('full', 'Full Payment'),
        ('partial', 'Partial Payment'),
        ('deposit', 'Deposit'),
        ('refund', 'Refund'),
    ]
    
    # Relationships
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
    
    # Payment details
    method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        help_text="Payment method"
    )
    
    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPE_CHOICES,
        default='full',
        help_text="Type of payment"
    )
    
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Payment amount"
    )
    
    # Transaction tracking
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
    
    # Enhanced fields
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

    # Phase 1: Idempotency key to prevent duplicate processing
    idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Unique key to prevent duplicate payment processing'
    )
    
    # Refund tracking
    is_refunded = models.BooleanField(
        default=False,
        help_text="Whether this payment has been refunded"
    )
    
    refund_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Amount refunded from this payment"
    )
    
    refund_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When refund was processed"
    )
    
    refund_reason = models.TextField(
        blank=True,
        help_text="Reason for refund"
    )
    
    processed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Staff member who processed this payment"
    )
    
    # Tracking
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
        """Validation before saving"""
        if self.payment_type == 'refund' and self.amount > 0:
            raise ValidationError("Refund amount must be negative")
        
        if self.payment_type != 'refund' and self.amount < 0:
            raise ValidationError("Payment amount must be positive")
        
        # Check if amount exceeds balance (only for new payments)
        if not self.pk and self.status == 'completed' and self.payment_type != 'refund':
            if self.amount > self.invoice.balance_due:
                raise ValidationError(
                    f"Payment amount ${self.amount} exceeds balance due ${self.invoice.balance_due}"
                )
    
    def save(self, *args, **kwargs):
        """Save payment with idempotency and row-level locking on invoice/guest"""
        from django.db import transaction
        # Validate before saving
        self.clean()

        if self.idempotency_key and not self.pk:
            if Payment.objects.filter(idempotency_key=self.idempotency_key).exists():
                raise ValidationError(f'Payment with idempotency key {self.idempotency_key} already exists')

        with transaction.atomic():
            # Lock invoice row
            invoice_locked = Invoice.objects.select_for_update().get(pk=self.invoice_id)

            super().save(*args, **kwargs)

            # Recalculate totals under the same lock
            invoice_locked.recalculate_totals()

            # Update guest loyalty points for completed payments
            if self.status == 'completed':
                guest = invoice_locked.guest
                # Lock guest (if applicable)
                try:
                    from guests.models import Guest
                    guest_locked = Guest.objects.select_for_update().get(pk=guest.pk)
                except Exception:
                    guest_locked = guest

                if hasattr(guest_locked, 'loyalty_points') and hasattr(guest_locked, 'total_spent'):
                    if self.payment_type == 'refund':
                        points_change = -int(abs(self.amount))
                        spending_change = -abs(self.amount)
                    else:
                        points_change = int(self.amount)
                        spending_change = self.amount

                    guest_locked.loyalty_points = max(0, (guest_locked.loyalty_points or 0) + points_change)
                    guest_locked.total_spent = max(
                        Decimal('0.00'),
                        (guest_locked.total_spent or Decimal('0.00')) + spending_change
                    )
                    guest_locked.save(update_fields=['loyalty_points', 'total_spent'])
    
    def process_refund(self, amount, reason=""):
        """Process a refund for this payment with locking and validation"""
        from django.db import transaction
        from django.core.exceptions import ValidationError

        if amount <= 0:
            raise ValidationError("Refund amount must be positive")

        with transaction.atomic():
            # Lock this payment row to prevent concurrent refunds
            payment = Payment.objects.select_for_update().get(pk=self.pk)

            available_amount = payment.amount - payment.refund_amount
            if amount > available_amount:
                raise ValidationError(
                    f"Refund amount ${amount} cannot exceed remaining payment amount ${available_amount}"
                )

            payment.refund_amount += amount
            payment.is_refunded = payment.refund_amount >= payment.amount
            payment.refund_reason = reason
            payment.refund_date = timezone.now()
            payment.save(update_fields=[
                'refund_amount', 'is_refunded', 'refund_reason', 'refund_date'
            ])
    
    def can_be_refunded(self):
        """Check if this payment can be refunded"""
        return (
            self.status == 'completed' and
            self.payment_type != 'refund' and
            self.amount > 0 and
            not self.is_refunded
        )
    
    def get_display_amount(self):
        """Get formatted amount for display"""
        return f"${abs(self.amount):.2f}"
    
    def is_refund(self):
        """Check if this is a refund"""
        return self.payment_type == 'refund' or self.amount < 0


class Refund(models.Model):
    """Model to track refunds separately"""
    REFUND_STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("processed", "Processed"),
        ("rejected", "Rejected"),
    )

    invoice = models.ForeignKey(
        'pos.Invoice',
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    
    payment = models.ForeignKey(
        'pos.Payment',
        on_delete=models.CASCADE,
        related_name='refunds',
        null=True,
        blank=True
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    reason = models.TextField()
    
    status = models.CharField(
        max_length=20,
        choices=REFUND_STATUS_CHOICES,
        default="pending"
    )
    
    requested_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_requests'
    )
    
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_approvals'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Refund {self.amount} for {self.invoice}"


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
