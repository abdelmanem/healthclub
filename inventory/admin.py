from django.contrib import admin
from .models import (
    Supplier, ProductCategory, Product, StockMovement, 
    PurchaseOrder, PurchaseOrderItem, ProductServiceLink, InventoryAlert
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "email", "phone", "is_active")
    search_fields = ("name", "contact_person", "email")
    list_filter = ("is_active", "created_at")
    ordering = ["name"]


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent_category", "is_active")
    search_fields = ("name", "description")
    list_filter = ("is_active", "parent_category")
    ordering = ["name"]


class StockMovementInline(admin.TabularInline):
    model = StockMovement
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name", "sku", "category", "product_type", "current_stock", 
        "min_stock_level", "selling_price", "is_active", "is_low_stock"
    )
    search_fields = ("name", "sku", "barcode", "description")
    list_filter = ("product_type", "category", "is_active", "is_taxable")
    ordering = ["name"]
    inlines = [StockMovementInline]
    readonly_fields = ("current_stock", "created_at", "updated_at")
    
    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True
    is_low_stock.short_description = "Low Stock"


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "reference", "created_at", "created_by")
    search_fields = ("product__name", "reference", "notes")
    list_filter = ("movement_type", "created_at", "created_by")
    ordering = ["-created_at"]
    list_select_related = ("product", "created_by")


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "po_number", "supplier", "status", "order_date", 
        "expected_delivery", "total_amount", "created_by"
    )
    search_fields = ("po_number", "supplier__name")
    list_filter = ("status", "order_date", "supplier")
    ordering = ["-order_date"]
    inlines = [PurchaseOrderItemInline]
    readonly_fields = ("subtotal", "tax_amount", "total_amount", "created_at", "updated_at")


@admin.register(PurchaseOrderItem)
class PurchaseOrderItemAdmin(admin.ModelAdmin):
    list_display = ("purchase_order", "product", "quantity_ordered", "quantity_received", "unit_cost", "line_total")
    search_fields = ("purchase_order__po_number", "product__name")
    list_filter = ("purchase_order__status", "purchase_order__supplier")
    list_select_related = ("purchase_order", "product")


@admin.register(ProductServiceLink)
class ProductServiceLinkAdmin(admin.ModelAdmin):
    list_display = ("service", "product", "quantity_required", "is_optional")
    search_fields = ("service__name", "product__name")
    list_filter = ("is_optional", "service", "product")
    list_select_related = ("service", "product")


@admin.register(InventoryAlert)
class InventoryAlertAdmin(admin.ModelAdmin):
    list_display = ("product", "alert_type", "is_resolved", "created_at", "resolved_by")
    search_fields = ("product__name", "message")
    list_filter = ("alert_type", "is_resolved", "created_at")
    ordering = ["-created_at"]
    list_select_related = ("product", "resolved_by")
