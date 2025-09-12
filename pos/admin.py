from django.contrib import admin
from .models import PosConfig, Invoice, InvoiceItem, Payment


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
    list_display = ("invoice_number", "guest", "reservation", "date", "total", "status")
    list_filter = ("status",)
    search_fields = ("invoice_number", "guest__first_name", "guest__last_name")
    inlines = [InvoiceItemInline, PaymentInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("invoice", "service", "product_name", "quantity", "unit_price")
    search_fields = ("product_name", "invoice__invoice_number")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "method", "amount", "payment_date")
    list_filter = ("method",)

# Register your models here.
