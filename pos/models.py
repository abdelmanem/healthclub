from django.db import models
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal


class PosConfig(models.Model):
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    service_charge_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    history = HistoricalRecords()

    class Meta:
        verbose_name = 'POS configuration'
        verbose_name_plural = 'POS configuration'

    def __str__(self) -> str:
        return f"VAT {self.vat_rate}% / Service {self.service_charge_rate}%"


class Invoice(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_ISSUED = 'issued'
    STATUS_PAID = 'paid'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = (
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ISSUED, 'Issued'),
        (STATUS_PAID, 'Paid'),
        (STATUS_CANCELLED, 'Cancelled'),
    )

    guest = models.ForeignKey('guests.Guest', on_delete=models.CASCADE, related_name='invoices')
    reservation = models.ForeignKey('reservations.Reservation', on_delete=models.CASCADE, related_name='invoices', null=True, blank=True)
    invoice_number = models.CharField(max_length=50, unique=True)
    date = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-date']

    def __str__(self) -> str:
        return f"Invoice {self.invoice_number}"

    def recalculate_totals(self) -> None:
        subtotal = Decimal("0.00")
        for item in self.items.all():
            line_subtotal = item.unit_price * item.quantity
            subtotal += line_subtotal

        # Service charge (percentage of subtotal)
        from .models import PosConfig

        cfg = PosConfig.objects.first()
        service_charge = Decimal("0.00")
        vat_total = Decimal("0.00")
        if cfg:
            if cfg.service_charge_rate:
                service_charge = (subtotal * (cfg.service_charge_rate / Decimal("100")))

        # Item-level tax + VAT on subtotal + service charge
        item_tax = Decimal("0.00")
        for item in self.items.all():
            if item.tax_rate:
                item_tax += (item.unit_price * item.quantity) * (item.tax_rate / Decimal("100"))
        if cfg and cfg.vat_rate:
            vat_total = (subtotal + service_charge) * (cfg.vat_rate / Decimal("100"))

        self.tax = item_tax + vat_total
        self.total = subtotal + service_charge + self.tax - self.discount
        self.save(update_fields=["tax", "total"])

    @staticmethod
    def generate_invoice_number() -> str:
        # Simple auto-incremental pattern: INV-<pk+1>-<YYYYMMDDHHMM>
        from django.utils import timezone

        timestamp = timezone.now().strftime("%Y%m%d%H%M")
        last = Invoice.objects.order_by("-id").first()
        base = (last.id + 1) if last else 1
        return f"INV-{base}-{timestamp}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey('pos.Invoice', on_delete=models.CASCADE, related_name='items')
    # Either a service or a product; using Generic relation via text fields for now
    service = models.ForeignKey('services.Service', on_delete=models.CASCADE, related_name='invoice_items', null=True, blank=True)
    product_name = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])

    history = HistoricalRecords()

    class Meta:
        verbose_name = 'Invoice item'
        verbose_name_plural = 'Invoice items'

    def __str__(self) -> str:
        if self.service:
            return f"{self.service.name} x{self.quantity}"
        return f"{self.product_name} x{self.quantity}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class Payment(models.Model):
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

    invoice = models.ForeignKey('pos.Invoice', on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    transaction_id = models.CharField(max_length=100, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="completed")
    
    # Enhanced payment fields
    processing_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gateway_response = models.JSONField(default=dict, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    
    # Refund tracking
    is_refunded = models.BooleanField(default=False)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    refund_date = models.DateTimeField(null=True, blank=True)
    refund_reason = models.TextField(blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-payment_date']

    def __str__(self) -> str:
        return f"Payment {self.amount} {self.method} for {self.invoice}"
    
    def process_refund(self, amount, reason=""):
        """Process a refund for this payment"""
        if amount > self.amount - self.refund_amount:
            raise ValueError("Refund amount cannot exceed remaining payment amount")
        
        self.refund_amount += amount
        self.is_refunded = self.refund_amount >= self.amount
        self.refund_reason = reason
        self.save()


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
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=REFUND_STATUS_CHOICES, default="pending")
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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    issued_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)
    
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
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Discount amount or percentage")
    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Maximum number of uses")
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    applicable_services = models.ManyToManyField(
        'services.Service',
        blank=True,
        help_text="Services this code applies to (leave empty for all services)"
    )
    
    class Meta:
        ordering = ['-valid_from']

    def __str__(self) -> str:
        return f"{self.code} - {self.description}"
    
    def is_valid(self):
        """Check if the promotional code is valid"""
        from django.utils import timezone
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
    data = models.JSONField(default=dict, help_text="Report data in JSON format")
    file_path = models.CharField(max_length=500, blank=True, help_text="Path to generated report file")
    
    class Meta:
        ordering = ['-generated_at']

    def __str__(self) -> str:
        return f"{self.name} - {self.get_report_type_display()}"

# Create your models here.
