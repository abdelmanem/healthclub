from rest_framework import serializers
from .models import Invoice, InvoiceItem, Payment


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            "id",
            "service",
            "product_name",
            "quantity",
            "unit_price",
            "tax_rate",
            "line_total",
        ]
        read_only_fields = ["line_total"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "amount", "transaction_id", "payment_date"]
        read_only_fields = ["payment_date"]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "guest",
            "reservation",
            "date",
            "total",
            "tax",
            "discount",
            "status",
            "notes",
            "items",
            "payments",
        ]
        read_only_fields = ["date", "invoice_number", "total", "tax"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        payments_data = validated_data.pop("payments", [])
        if not validated_data.get("invoice_number"):
            validated_data["invoice_number"] = Invoice.generate_invoice_number()
        invoice = Invoice.objects.create(**validated_data)
        for item in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item)
        for pay in payments_data:
            Payment.objects.create(invoice=invoice, **pay)
        invoice.recalculate_totals()
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        payments_data = validated_data.pop("payments", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                InvoiceItem.objects.create(invoice=instance, **item)
        if payments_data is not None:
            instance.payments.all().delete()
            for pay in payments_data:
                Payment.objects.create(invoice=instance, **pay)
        instance.recalculate_totals()
        return instance

