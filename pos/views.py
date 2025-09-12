from rest_framework import viewsets, decorators, response, status
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().select_related("guest", "reservation").order_by("-date")
    serializer_class = InvoiceSerializer

    @decorators.action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        invoice = self.get_object()
        invoice.recalculate_totals()
        return response.Response(self.get_serializer(invoice).data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().select_related("invoice").order_by("-payment_date")
    serializer_class = PaymentSerializer
