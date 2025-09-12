from rest_framework import viewsets, decorators, response, status, filters
from .models import Location, Reservation
from .serializers import LocationSerializer, ReservationSerializer
from pos import create_invoice_for_reservation

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all().order_by("name")
    serializer_class = LocationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "description"]


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().select_related("guest", "location").order_by("-start_time")
    serializer_class = ReservationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["guest__first_name", "guest__last_name", "notes"]

    @decorators.action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_CHECKED_IN
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status})

    @decorators.action(detail=True, methods=["post"], url_path="in-service")
    def in_service(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_IN_SERVICE
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_COMPLETED
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status})

    @decorators.action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_CHECKED_OUT
        reservation.save(update_fields=["status"])
        return response.Response({"status": reservation.status})

    @decorators.action(detail=True, methods=["post"], url_path="create-invoice")
    def create_invoice(self, request, pk=None):
        reservation = self.get_object()
        invoice = create_invoice_for_reservation(reservation)
        return response.Response({"invoice_id": invoice.id, "invoice_number": invoice.invoice_number}, status=status.HTTP_201_CREATED)
