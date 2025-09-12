from django.db import models
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords


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


class Payment(models.Model):
    METHOD_CASH = 'cash'
    METHOD_CARD = 'card'
    METHOD_WALLET = 'wallet'
    METHOD_CHOICES = (
        (METHOD_CASH, 'Cash'),
        (METHOD_CARD, 'Card'),
        (METHOD_WALLET, 'Wallet'),
    )

    invoice = models.ForeignKey('pos.Invoice', on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    transaction_id = models.CharField(max_length=100, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ['-payment_date']

    def __str__(self) -> str:
        return f"Payment {self.amount} {self.method} for {self.invoice}"

# Create your models here.
