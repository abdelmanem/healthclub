from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().select_related("guest", "reservation").order_by("-date")
    serializer_class = InvoiceSerializer
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

    @decorators.action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        invoice = self.get_object()
        invoice.recalculate_totals()
        return response.Response(self.get_serializer(invoice).data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().select_related("invoice").order_by("-payment_date")
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["transaction_id", "invoice__invoice_number"]
    ordering_fields = ["payment_date", "amount"]
    filterset_fields = {
        'invoice': ['exact', 'in'],
        'method': ['exact', 'in'],
        'amount': ['gte', 'lte'],
        'payment_date': ['gte', 'lte'],
    }
