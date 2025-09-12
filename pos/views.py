from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from healthclub.permissions import ObjectPermissionsOrReadOnly

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().select_related("guest", "reservation").order_by("-date")
    serializer_class = InvoiceSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "guest__first_name", "guest__last_name"]
    ordering_fields = ["date", "total"]
    filterset_fields = {
        'guest': ['exact', 'in'],
        'reservation': ['exact', 'in', 'isnull'],
        'status': ['exact', 'in'],
        'date': ['gte', 'lte'],
        'total': ['gte', 'lte'],
    }

    @decorators.action(detail=False, methods=["get"], url_path="report-revenue")
    def report_revenue(self, request):
        from django.db.models import Sum
        total = self.get_queryset().filter(status__in=[Invoice.STATUS_ISSUED, Invoice.STATUS_PAID]).aggregate(Sum('total'))['total__sum'] or 0
        paid = self.get_queryset().filter(status=Invoice.STATUS_PAID).aggregate(Sum('total'))['total__sum'] or 0
        return response.Response({"total": total, "paid": paid})

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'pos.view_invoice', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    @decorators.action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = Invoice.STATUS_CANCELLED
        invoice.save(update_fields=["status"])
        return response.Response({"status": invoice.status})

    @decorators.action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        invoice = self.get_object()
        invoice.recalculate_totals()
        return response.Response(self.get_serializer(invoice).data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().select_related("invoice").order_by("-payment_date")
    serializer_class = PaymentSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["transaction_id", "invoice__invoice_number"]
    ordering_fields = ["payment_date", "amount"]
    filterset_fields = {
        'invoice': ['exact', 'in'],
        'method': ['exact', 'in'],
        'amount': ['gte', 'lte'],
        'payment_date': ['gte', 'lte'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'pos.view_payment', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    def perform_create(self, serializer):
        payment = serializer.save()
        invoice = payment.invoice
        invoice.recalculate_totals()
        # Auto-mark paid if total covered
        from decimal import Decimal
        total_paid = sum(p.amount for p in invoice.payments.all())
        if total_paid >= invoice.total:
            invoice.status = Invoice.STATUS_PAID
            invoice.save(update_fields=["status"])
