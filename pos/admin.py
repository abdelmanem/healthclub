from django.contrib import admin
from .models import (
    PosConfig, Invoice, InvoiceItem, Payment, Refund, 
    GiftCard, PromotionalCode, FinancialReport
)


@admin.register(PosConfig)
class PosConfigAdmin(admin.ModelAdmin):
    list_display = ("vat_rate", "service_charge_rate")


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 1


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number", "guest", "reservation", "date", "total", 
        "status", "tax", "discount"
    )
    list_filter = ("status", "date")
    search_fields = ("invoice_number", "guest__first_name", "guest__last_name")
    inlines = [InvoiceItemInline, PaymentInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("invoice", "service", "product_name", "quantity", "unit_price", "line_total")
    search_fields = ("product_name", "invoice__invoice_number")
    list_filter = ("service",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "invoice", "method", "amount", "status", "payment_date", 
        "is_refunded", "refund_amount"
    )
    list_filter = ("method", "status", "is_refunded", "payment_date")
    search_fields = ("transaction_id", "reference", "invoice__invoice_number")


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        "invoice", "amount", "status", "requested_by", 
        "approved_by", "created_at", "processed_at"
    )
    list_filter = ("status", "created_at", "processed_at")
    search_fields = ("reason", "invoice__invoice_number")
    list_select_related = ("invoice", "requested_by", "approved_by")


@admin.register(GiftCard)
class GiftCardAdmin(admin.ModelAdmin):
    list_display = (
        "code", "guest", "original_amount", "remaining_amount", 
        "status", "issued_date", "expiry_date"
    )
    list_filter = ("status", "issued_date", "expiry_date")
    search_fields = ("code", "guest__first_name", "guest__last_name")
    list_select_related = ("guest", "issued_by")


@admin.register(PromotionalCode)
class PromotionalCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code", "description", "code_type", "discount_value", 
        "is_active", "used_count", "usage_limit", "valid_from", "valid_until"
    )
    list_filter = ("code_type", "is_active", "valid_from", "valid_until")
    search_fields = ("code", "description")
    filter_horizontal = ("applicable_services",)


@admin.register(FinancialReport)
class FinancialReportAdmin(admin.ModelAdmin):
    list_display = (
        "name", "report_type", "start_date", "end_date", 
        "generated_by", "generated_at"
    )
    list_filter = ("report_type", "generated_at", "start_date", "end_date")
    search_fields = ("name", "generated_by__username")
    list_select_related = ("generated_by",)

# Register your models here.
