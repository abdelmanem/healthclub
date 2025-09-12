from django.db import models
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords


class Supplier(models.Model):
    """Model to manage suppliers/vendors"""
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class ProductCategory(models.Model):
    """Model to categorize products"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    parent_category = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Product Categories"
    
    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    """Model to manage retail products and supplies"""
    PRODUCT_TYPES = (
        ('retail', 'Retail Product'),
        ('supply', 'Supply Item'),
        ('equipment', 'Equipment'),
        ('consumable', 'Consumable'),
    )
    
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100, unique=True, help_text="Stock Keeping Unit")
    barcode = models.CharField(max_length=100, blank=True, unique=True, null=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        'inventory.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='retail')
    
    # Pricing
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    
    # Inventory tracking
    current_stock = models.PositiveIntegerField(default=0)
    min_stock_level = models.PositiveIntegerField(default=0, help_text="Reorder when stock falls below this level")
    max_stock_level = models.PositiveIntegerField(default=1000)
    
    # Product details
    unit_of_measure = models.CharField(max_length=20, default='piece', help_text="e.g., piece, kg, liter")
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Weight in kg")
    dimensions = models.CharField(max_length=100, blank=True, help_text="L x W x H")
    
    # Status and tracking
    is_active = models.BooleanField(default=True)
    is_taxable = models.BooleanField(default=True)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Tax rate percentage")
    
    # Supplier information
    primary_supplier = models.ForeignKey(
        'inventory.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['name']
    
    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"
    
    @property
    def is_low_stock(self):
        """Check if product is below minimum stock level"""
        return self.current_stock <= self.min_stock_level
    
    @property
    def stock_value(self):
        """Calculate total stock value"""
        return self.current_stock * self.cost_price
    
    def add_stock(self, quantity, notes=""):
        """Add stock to inventory"""
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        self.current_stock += quantity
        self.save(update_fields=['current_stock'])
        
        # Create stock movement record
        StockMovement.objects.create(
            product=self,
            movement_type='in',
            quantity=quantity,
            notes=notes
        )
    
    def remove_stock(self, quantity, notes=""):
        """Remove stock from inventory"""
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if quantity > self.current_stock:
            raise ValueError("Insufficient stock")
        
        self.current_stock -= quantity
        self.save(update_fields=['current_stock'])
        
        # Create stock movement record
        StockMovement.objects.create(
            product=self,
            movement_type='out',
            quantity=quantity,
            notes=notes
        )


class StockMovement(models.Model):
    """Model to track all stock movements"""
    MOVEMENT_TYPES = (
        ('in', 'Stock In'),
        ('out', 'Stock Out'),
        ('adjustment', 'Stock Adjustment'),
        ('transfer', 'Transfer'),
        ('return', 'Return'),
    )
    
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.CASCADE,
        related_name='stock_movements'
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.IntegerField(help_text="Positive for stock in, negative for stock out")
    reference = models.CharField(max_length=100, blank=True, help_text="PO number, invoice number, etc.")
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"{self.product.name} - {self.get_movement_type_display()} - {self.quantity}"


class PurchaseOrder(models.Model):
    """Model to manage purchase orders"""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    )
    
    po_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(
        'inventory.Supplier',
        on_delete=models.CASCADE,
        related_name='purchase_orders'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    order_date = models.DateField()
    expected_delivery = models.DateField(null=True, blank=True)
    actual_delivery = models.DateField(null=True, blank=True)
    
    # Totals
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Tracking
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_purchase_orders'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-order_date']
    
    def __str__(self) -> str:
        return f"PO {self.po_number} - {self.supplier.name}"
    
    def calculate_totals(self):
        """Calculate order totals"""
        self.subtotal = sum(item.line_total for item in self.items.all())
        self.tax_amount = sum(item.tax_amount for item in self.items.all())
        self.total_amount = self.subtotal + self.tax_amount
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])


class PurchaseOrderItem(models.Model):
    """Model for purchase order line items"""
    purchase_order = models.ForeignKey(
        'inventory.PurchaseOrder',
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.CASCADE,
        related_name='purchase_order_items'
    )
    quantity_ordered = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ('purchase_order', 'product')
    
    def __str__(self) -> str:
        return f"{self.purchase_order.po_number} - {self.product.name}"
    
    @property
    def line_total(self):
        """Calculate line total before tax"""
        return self.quantity_ordered * self.unit_cost
    
    @property
    def tax_amount(self):
        """Calculate tax amount for this line"""
        return (self.line_total * self.tax_rate) / 100


class ProductServiceLink(models.Model):
    """Model to link products used in services"""
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.CASCADE,
        related_name='required_products'
    )
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.CASCADE,
        related_name='used_in_services'
    )
    quantity_required = models.PositiveIntegerField(default=1)
    is_optional = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('service', 'product')
    
    def __str__(self) -> str:
        return f"{self.service.name} - {self.product.name}"


class InventoryAlert(models.Model):
    """Model to track inventory alerts and notifications"""
    ALERT_TYPES = (
        ('low_stock', 'Low Stock'),
        ('out_of_stock', 'Out of Stock'),
        ('overstock', 'Overstock'),
        ('expiring', 'Expiring Soon'),
    )
    
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"{self.product.name} - {self.get_alert_type_display()}"
