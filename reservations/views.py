from rest_framework import viewsets, decorators, response, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Location, Reservation, ReservationService, HousekeepingTask
from .serializers import LocationSerializer, ReservationSerializer, HousekeepingTaskSerializer
from pos import create_invoice_for_reservation
from healthclub.permissions import ObjectPermissionsOrReadOnly
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from django.db.models import OuterRef, Subquery
from django.db import transaction
from decimal import Decimal

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all().order_by("name")
    serializer_class = LocationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name"]
    filterset_fields = {
        'name': ['exact', 'icontains'],
        'gender': ['exact', 'in'],
        'is_clean': ['exact'],
        'is_occupied': ['exact'],
        'type': ['exact', 'in'],
        'status': ['exact', 'in'],
        'is_active': ['exact'],
        'is_out_of_service': ['exact'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'reservations.view_location', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms
        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    @decorators.action(detail=True, methods=["post"], url_path="mark-clean")
    def mark_clean(self, request, pk=None):
        obj = self.get_object()
        obj.is_clean = True
        obj.save(update_fields=["is_clean"])
        return response.Response({"id": obj.id, "is_clean": obj.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-dirty")
    def mark_dirty(self, request, pk=None):
        obj = self.get_object()
        obj.is_clean = False
        obj.save(update_fields=["is_clean"])
        return response.Response({"id": obj.id, "is_clean": obj.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-occupied")
    def mark_occupied(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = True
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="mark-vacant")
    def mark_vacant(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = False
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="out-of-service")
    def out_of_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = True
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})

    @decorators.action(detail=True, methods=["post"], url_path="back-in-service")
    def back_in_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = False
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})


class HousekeepingTaskViewSet(viewsets.ModelViewSet):
    queryset = HousekeepingTask.objects.all().select_related('location', 'reservation', 'assigned_to')
    serializer_class = HousekeepingTaskSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['location__name', 'notes']
    ordering_fields = ['created_at', 'status']
    filterset_fields = {
        'status': ['exact', 'in'],
        'location': ['exact', 'in'],
        'assigned_to': ['exact', 'in'],
        'priority': ['exact', 'in'],
    }

    @decorators.action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        if task.status not in [HousekeepingTask.STATUS_PENDING, HousekeepingTask.STATUS_CANCELLED]:
            return response.Response({"error": "Task already started or completed"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_IN_PROGRESS
        task.started_at = timezone.now()
        task.save(update_fields=["status", "started_at"])
        return response.Response({"status": task.status, "started_at": task.started_at})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.status == HousekeepingTask.STATUS_COMPLETED:
            return response.Response({"error": "Task already completed"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_COMPLETED
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_at"])
        # Mark room clean when housekeeping completes
        try:
            task.location.is_clean = True
            task.location.save(update_fields=["is_clean"])
        except Exception:
            pass
        return response.Response({"status": task.status, "completed_at": task.completed_at, "location_is_clean": task.location.is_clean})

    @decorators.action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        from django.db.models import Count, Avg, DurationField, ExpressionWrapper, F
        qs = self.get_queryset()
        counts = qs.values('status').annotate(count=Count('id'))
        # average completion time (completed_at - created_at)
        completed = qs.filter(status=HousekeepingTask.STATUS_COMPLETED, completed_at__isnull=False)
        from django.db.models.functions import Now
        duration_expr = ExpressionWrapper(F('completed_at') - F('created_at'), output_field=DurationField())
        avg_duration = completed.aggregate(avg=Avg(duration_expr)).get('avg')
        return response.Response({
            'counts': list(counts),
            'avg_completion_duration_seconds': int(avg_duration.total_seconds()) if avg_duration else None,
        })

    @decorators.action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.status == HousekeepingTask.STATUS_COMPLETED:
            return response.Response({"error": "Cannot cancel a completed task"}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        task.status = HousekeepingTask.STATUS_CANCELLED
        task.cancelled_at = timezone.now()
        
        # Handle cancellation reason if provided
        reason_id = request.data.get('cancellation_reason')
        if reason_id:
            try:
                from config.models import CancellationReason
                reason = CancellationReason.objects.get(id=reason_id, is_active=True)
                task.cancellation_reason = reason
            except Exception:
                pass
                
        task.save(update_fields=["status", "cancelled_at", "cancellation_reason"])
        return response.Response({"status": task.status, "cancelled_at": task.cancelled_at})

    @decorators.action(detail=True, methods=["post"], url_path="mark-vacant")
    def mark_vacant(self, request, pk=None):
        obj = self.get_object()
        obj.is_occupied = False
        obj.save(update_fields=["is_occupied"])
        return response.Response({"id": obj.id, "is_occupied": obj.is_occupied})

    @decorators.action(detail=True, methods=["post"], url_path="out-of-service")
    def out_of_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = True
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})

    @decorators.action(detail=True, methods=["post"], url_path="back-in-service")
    def back_in_service(self, request, pk=None):
        obj = self.get_object()
        obj.is_out_of_service = False
        obj.save(update_fields=["is_out_of_service"])
        return response.Response({"id": obj.id, "is_out_of_service": obj.is_out_of_service})


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().select_related(
        "guest", 
        "location"
    ).prefetch_related(
        "reservation_services__service__category",
        "employee_assignments__employee__user"
    ).order_by("-start_time")
    serializer_class = ReservationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["guest__first_name", "guest__last_name", "notes"]
    ordering_fields = ["start_time", "end_time"]
    filterset_fields = {
        'guest': ['exact', 'in'],
        'location': ['exact', 'in'],
        'status': ['exact', 'in'],
        'start_time': ['gte', 'lte', 'date'],
        'end_time': ['gte', 'lte', 'date'],
        'reservation_services__service': ['exact', 'in'],
    }

    @decorators.action(detail=False, methods=["get"], url_path="report-utilization")
    def report_utilization(self, request):
        from django.db.models import Count
        data = self.get_queryset().values('location__name').annotate(bookings=Count('id')).order_by('-bookings')
        return response.Response(list(data))

    @decorators.action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        reservation = self.get_object()
        
        # Validate reservation can be checked in
        if reservation.status != Reservation.STATUS_BOOKED:
            return response.Response(
                {
                    'error': 'Reservation must be booked before check-in',
                    'current_status': reservation.status,
                    'allowed_statuses': [Reservation.STATUS_BOOKED]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check room availability if location is assigned
        if getattr(reservation, 'location_id', None):
            loc = reservation.location
            if getattr(loc, 'is_out_of_service', False):
                return response.Response(
                    {"error": "Room is out of service"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check capacity-based availability instead of just occupied status
            current_active_reservations = Reservation.objects.filter(
                location=loc,
                status__in=[Reservation.STATUS_CHECKED_IN, Reservation.STATUS_IN_SERVICE]
            ).exclude(pk=reservation.pk)  # Exclude current reservation
            
            room_capacity = getattr(loc, 'capacity', 1) or 1
            if current_active_reservations.count() >= room_capacity:
                return response.Response(
                    {
                        "error": "Room is at capacity",
                        "reason_code": "room_at_capacity",
                        "message": f"Room capacity is {room_capacity} and currently has {current_active_reservations.count()} active reservations.",
                        "current_capacity": current_active_reservations.count(),
                        "max_capacity": room_capacity
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        reservation.status = Reservation.STATUS_CHECKED_IN
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "checked_in_at": reservation.checked_in_at})

    @decorators.action(detail=True, methods=["post"], url_path="in-service")
    def in_service(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_IN_SERVICE
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "in_service_at": reservation.in_service_at})

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_COMPLETED
        reservation.save()  # Use full save() to trigger signals properly
        return response.Response({"status": reservation.status, "completed_at": reservation.completed_at})

    @decorators.action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        """
        Check out a completed reservation.
        
        This action follows the workflow:
        1. Changes status to CHECKED_OUT
        2. Triggers signals to mark room dirty and create housekeeping task
        3. Optionally creates invoice if requested
        
        Endpoint: POST /api/reservations/{id}/check-out/
        
        Request Body:
        {
            "create_invoice": true,  // Optional: create invoice after checkout
            "notes": "Additional notes"  // Optional: notes for checkout
        }
        
        Response:
        {
            "status": "checked_out",
            "checked_out_at": "2025-01-15T10:30:00Z",
            "invoice_created": true,  // If invoice was created
            "invoice_id": 42,  // If invoice was created
            "housekeeping_task_created": true,
            "message": "Reservation checked out successfully"
        }
        """
        reservation = self.get_object()
        
        # Validate reservation can be checked out
        if reservation.status not in [Reservation.STATUS_COMPLETED]:
            return response.Response(
                {
                    'error': 'Reservation must be completed before checkout',
                    'current_status': reservation.status,
                    'allowed_statuses': [Reservation.STATUS_COMPLETED]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        create_invoice = request.data.get('create_invoice', False)
        checkout_notes = request.data.get('notes', '')
        
        with transaction.atomic():
            # Update reservation status (triggers signals automatically)
            reservation.status = Reservation.STATUS_CHECKED_OUT
            if checkout_notes:
                reservation.notes = f"{reservation.notes}\nCheckout: {checkout_notes}".strip()
            reservation.save()
            
            # Prepare response data
            response_data = {
                "status": reservation.status,
                "checked_out_at": reservation.checked_out_at,
                "housekeeping_task_created": True,  # Signal creates this automatically
                "message": "Reservation checked out successfully"
            }
            
            # Create invoice if requested
            if create_invoice:
                try:
                    # Check if invoice already exists
                    existing_invoice = Invoice.objects.filter(reservation=reservation).first()
                    if existing_invoice:
                        response_data.update({
                            "invoice_created": False,
                            "invoice_id": existing_invoice.id,
                            "invoice_number": existing_invoice.invoice_number,
                            "message": "Reservation checked out. Invoice already exists."
                        })
                    else:
                        # Create invoice using the existing create_invoice logic
                        invoice_number = Invoice.generate_invoice_number()
                        invoice = Invoice.objects.create(
                            reservation=reservation,
                            guest=reservation.guest,
                            invoice_number=invoice_number,
                            due_date=timezone.now().date(),
                            status='issued',
                            notes=f'Invoice for reservation #{reservation.id} - Checkout: {checkout_notes}'.strip(),
                            created_by=request.user if request.user.is_authenticated else None
                        )
                        
                        # Create invoice line items from reservation services
                        if hasattr(reservation, 'reservation_services'):
                            for res_service in reservation.reservation_services.all():
                                service_name = (
                                    res_service.service_details.name if hasattr(res_service, 'service_details') and res_service.service_details
                                    else f"Service #{res_service.service}"
                                )
                                unit_price = (
                                    res_service.unit_price if hasattr(res_service, 'unit_price')
                                    else res_service.service_details.price if hasattr(res_service, 'service_details')
                                    else Decimal('0.00')
                                )
                                quantity = res_service.quantity if hasattr(res_service, 'quantity') else 1
                                
                                InvoiceItem.objects.create(
                                    invoice=invoice,
                                    service=res_service.service if hasattr(res_service, 'service') else None,
                                    product_name=service_name,
                                    quantity=quantity,
                                    unit_price=unit_price,
                                    tax_rate=Decimal('8.00'),  # Default tax rate
                                )
                        
                        # If no services, create a generic line item
                        if not invoice.items.exists():
                            # Calculate total from reservation services
                            total_from_services = Decimal('0.00')
                            if hasattr(reservation, 'reservation_services'):
                                for res_service in reservation.reservation_services.all():
                                    if hasattr(res_service, 'total_price'):
                                        total_from_services += res_service.total_price
                                    elif hasattr(res_service, 'unit_price') and hasattr(res_service, 'quantity'):
                                        total_from_services += (res_service.unit_price or Decimal('0.00')) * (res_service.quantity or 1)
                            
                            InvoiceItem.objects.create(
                                invoice=invoice,
                                product_name=f"Reservation #{reservation.id}",
                                quantity=1,
                                unit_price=total_from_services,
                                tax_rate=Decimal('8.00'),
                            )
                        
                        # Recalculate totals
                        invoice.recalculate_totals()
                        
                        response_data.update({
                            "invoice_created": True,
                            "invoice_id": invoice.id,
                            "invoice_number": invoice.invoice_number,
                            "invoice_total": str(invoice.total),
                            "message": "Reservation checked out and invoice created successfully"
                        })
                        
                except Exception as e:
                    response_data.update({
                        "invoice_created": False,
                        "invoice_error": str(e),
                        "message": "Reservation checked out but invoice creation failed"
                    })
            
            return response.Response(response_data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["get"], url_path="services")
    def get_services(self, request, pk=None):
        """Get detailed service information for a reservation"""
        reservation = self.get_object()
        services = []
        for rs in reservation.reservation_services.all():
            services.append({
                'id': rs.id,
                'service_id': rs.service.id,
                'service_name': rs.service.name,
                'service_description': rs.service.description,
                'service_duration_minutes': rs.service.duration_minutes,
                'service_price': rs.service.price,
                'service_category': rs.service.category.name if rs.service.category else None,
                'quantity': rs.quantity,
                'unit_price': rs.unit_price,
                'total_price': rs.total_price,
            })
        return response.Response(services)

    @decorators.action(detail=True, methods=["post"], url_path="add-service")
    def add_service(self, request, pk=None):
        """Add a service to an existing reservation"""
        reservation = self.get_object()
        service_id = request.data.get('service_id')
        quantity = request.data.get('quantity', 1)
        
        if not service_id:
            return response.Response(
                {"error": "service_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from services.models import Service
            service = Service.objects.get(id=service_id)
            
            # Check if service already exists in reservation
            existing_service = reservation.reservation_services.filter(service=service).first()
            if existing_service:
                existing_service.quantity += quantity
                existing_service.save()
                return response.Response({"message": "Service quantity updated"})
            else:
                ReservationService.objects.create(
                    reservation=reservation,
                    service=service,
                    quantity=quantity
                )
                return response.Response({"message": "Service added to reservation"})
                
        except Service.DoesNotExist:
            return response.Response(
                {"error": "Service not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @decorators.action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = Reservation.STATUS_CANCELLED
        reservation.cancelled_at = timezone.now()
        
        # Handle cancellation reason if provided
        reason_id = request.data.get('cancellation_reason')
        if reason_id:
            try:
                from config.models import CancellationReason
                reason = CancellationReason.objects.get(id=reason_id, is_active=True)
                reservation.cancellation_reason = reason
                # If the reason is NO_SHOW, record the no-show timestamp as well
                try:
                    if (getattr(reason, 'code', None) or '').upper() == 'NO_SHOW':
                        reservation.no_show_recorded_at = timezone.now()
                except Exception:
                    pass
            except Exception:
                pass
                
        reservation.save()
        return response.Response({
            "status": reservation.status,
            "cancelled_at": reservation.cancelled_at,
            "no_show_recorded_at": getattr(reservation, 'no_show_recorded_at', None)
        })
        
    @decorators.action(detail=True, methods=["post"], url_path="create-invoice")
    def create_invoice(self, request, pk=None):
        """
        Create invoice for completed reservation
        
        Endpoint: POST /api/reservations/{id}/create-invoice/
        
        Process:
        1. Validate reservation is completed/checked-out
        2. Check if invoice already exists
        3. Generate invoice number
        4. Create invoice with line items from reservation services
        5. Calculate totals
        6. Return invoice details
        
        Response:
        {
            "success": true,
            "invoice_id": 42,
            "invoice_number": "INV-000042",
            "total_amount": "108.00",
            "balance_due": "108.00",
            "message": "Invoice created successfully"
        }
        """
        reservation = self.get_object()
        
        # Validate reservation status
        if reservation.status not in ['completed', 'checked_out']:
            return response.Response(
                {
                    'error': 'Can only create invoice for completed/checked-out reservations',
                    'current_status': reservation.status,
                    'allowed_statuses': ['completed', 'checked_out']
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if invoice already exists
        from pos.models import Invoice, Deposit
        existing_invoice = Invoice.objects.filter(reservation=reservation).first()
        if existing_invoice:
            return response.Response({
                'success': True,
                'invoice_id': existing_invoice.id,
                'invoice_number': existing_invoice.invoice_number,
                'total_amount': str(existing_invoice.total),
                'balance_due': str(existing_invoice.balance_due),
                'invoice_status': existing_invoice.status,
                'message': 'Invoice already exists for this reservation'
            })
        
        with transaction.atomic():
            # Generate invoice number
            invoice_number = Invoice.generate_invoice_number()
            
            # Create invoice
            invoice = Invoice.objects.create(
                reservation=reservation,
                guest=reservation.guest,
                invoice_number=invoice_number,
                due_date=timezone.now().date(),  # Due immediately
                status='issued',
                notes=f'Invoice for reservation #{reservation.id}',
                created_by=request.user if request.user.is_authenticated else None
            )
            
            # Create invoice line items from reservation services
            from pos.models import InvoiceItem
            if hasattr(reservation, 'reservation_services'):
                for res_service in reservation.reservation_services.all():
                    # Get service details
                    service_name = (
                        res_service.service.name 
                        if hasattr(res_service, 'service') and res_service.service 
                        else f"Service #{res_service.service_id}"
                    )
                    
                    unit_price = (
                        res_service.unit_price 
                        if hasattr(res_service, 'unit_price') and res_service.unit_price
                        else res_service.service.price if hasattr(res_service, 'service') and res_service.service
                        else Decimal('0.00')
                    )
                    
                    quantity = res_service.quantity if hasattr(res_service, 'quantity') else 1
                    
                    # Create invoice item
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        service=res_service.service if hasattr(res_service, 'service') else None,
                        product_name=service_name,
                        quantity=quantity,
                        unit_price=unit_price,
                        tax_rate=Decimal('8.00'),  # Default tax rate, adjust as needed
                        notes=f'From reservation service #{res_service.id}'
                    )
            
            # If no services, create a generic line item
            if not invoice.items.exists():
                # Calculate total from reservation services
                total_from_services = Decimal('0.00')
                if hasattr(reservation, 'reservation_services'):
                    for res_service in reservation.reservation_services.all():
                        if hasattr(res_service, 'total_price'):
                            total_from_services += res_service.total_price
                        elif hasattr(res_service, 'unit_price') and hasattr(res_service, 'quantity'):
                            total_from_services += (res_service.unit_price or Decimal('0.00')) * (res_service.quantity or 1)
                
                InvoiceItem.objects.create(
                    invoice=invoice,
                    product_name=f"Reservation #{reservation.id}",
                    quantity=1,
                    unit_price=total_from_services,
                    tax_rate=Decimal('8.00'),
                    notes=f'Generic line item for reservation #{reservation.id}'
                )
            
            # 🎯 AUTO-APPLY DEPOSITS
            deposits = Deposit.objects.filter(
                reservation=reservation,
                status='paid',
                amount_applied__lt=models.F('amount')
            ).order_by('collected_at')
            
            deposits_applied = []
            for deposit in deposits:
                if invoice.balance_due > 0 and deposit.remaining_amount > 0:
                    try:
                        payment = deposit.apply_to_invoice(invoice)
                        deposits_applied.append({
                            'deposit_id': deposit.id,
                            'amount_applied': str(payment.amount),
                            'payment_id': payment.id
                        })
                    except Exception as e:
                        # Log error but continue
                        pass
            
            # Refresh invoice to get updated totals
            invoice.refresh_from_db()
        
        return response.Response({
            'success': True,
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'total_amount': str(invoice.total),
            'balance_due': str(invoice.balance_due),
            'amount_paid': str(invoice.amount_paid),
            'deposits_applied': deposits_applied,
            'deposits_applied_count': len(deposits_applied),
            'message': 'Invoice created successfully'
        }, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["get"], url_path="invoice-status")
    def invoice_status(self, request, pk=None):
        """
        Get invoice status for a reservation
        
        Endpoint: GET /api/reservations/{id}/invoice-status/
        
        Returns:
        {
            "has_invoice": true,
            "invoice_id": 42,
            "invoice_number": "INV-000042",
            "invoice_status": "paid",
            "total_amount": "108.00",
            "balance_due": "0.00",
            "can_create_invoice": false
        }
        """
        reservation = self.get_object()
        
        from pos.models import Invoice
        invoice = Invoice.objects.filter(reservation=reservation).first()
        
        if invoice:
            return response.Response({
                'has_invoice': True,
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'invoice_status': invoice.status,
                'total_amount': str(invoice.total),
                'balance_due': str(invoice.balance_due),
                'amount_paid': str(invoice.amount_paid),
                'can_create_invoice': False,
                'can_process_payment': invoice.can_be_paid(),
                'can_refund': invoice.can_be_refunded()
            })
        else:
            can_create = reservation.status in ['completed', 'checked_out']
            return response.Response({
                'has_invoice': False,
                'invoice_id': None,
                'invoice_number': None,
                'invoice_status': None,
                'total_amount': None,
                'balance_due': None,
                'amount_paid': None,
                'can_create_invoice': can_create,
                'can_process_payment': False,
                'can_refund': False,
                'reason': 'No invoice exists' if not can_create else 'Invoice can be created'
            })

    @decorators.action(detail=True, methods=["post"], url_path="process-payment")
    def process_payment(self, request, pk=None):
        """
        Process payment for reservation invoice
        
        Endpoint: POST /api/reservations/{id}/process-payment/
        
        Body:
        {
            "amount": "108.00",
            "payment_method": 2,
            "payment_type": "full",
            "reference": "VISA-4532",
            "transaction_id": "TXN-123456",
            "notes": "Payment processed at front desk"
        }
        """
        reservation = self.get_object()
        
        # Check if invoice exists
        from pos.models import Invoice
        invoice = Invoice.objects.filter(reservation=reservation).first()
        if not invoice:
            return response.Response(
                {
                    'error': 'No invoice found for this reservation',
                    'suggestion': 'Create an invoice first using /create-invoice/ endpoint'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delegate to invoice's process_payment action
        from pos.views import InvoiceViewSet
        invoice_viewset = InvoiceViewSet()
        invoice_viewset.request = request
        invoice_viewset.format_kwarg = None
        
        # Use the invoice's process_payment method
        return invoice_viewset.process_payment(request, pk=invoice.id)

    @decorators.action(detail=True, methods=["get"], url_path="payment-history")
    def payment_history(self, request, pk=None):
        """
        Get payment history for reservation invoice
        
        Endpoint: GET /api/reservations/{id}/payment-history/
        """
        reservation = self.get_object()
        
        # Check if invoice exists
        from pos.models import Invoice
        invoice = Invoice.objects.filter(reservation=reservation).first()
        if not invoice:
            return response.Response(
                {
                    'error': 'No invoice found for this reservation',
                    'suggestion': 'Create an invoice first using /create-invoice/ endpoint'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delegate to invoice's payment_history action
        from pos.views import InvoiceViewSet
        invoice_viewset = InvoiceViewSet()
        invoice_viewset.request = request
        invoice_viewset.format_kwarg = None
        
        # Use the invoice's payment_history method
        return invoice_viewset.payment_history(request, pk=invoice.id)

    @decorators.action(detail=True, methods=["post"], url_path="pay-deposit")
    def pay_deposit(self, request, pk=None):
        """
        Collect deposit payment for reservation
        
        Endpoint: POST /api/reservations/{id}/pay-deposit/
        
        Body:
        {
            "amount": "50.00",
            "payment_method": 2,  // PaymentMethod ID
            "reference": "VISA-4532",
            "transaction_id": "TXN-123456",
            "notes": "Deposit collected at booking"
        }
        
        Response:
        {
            "success": true,
            "deposit_id": 123,
            "amount": "50.00",
            "status": "paid",
            "reservation_id": 42,
            "message": "Deposit of $50.00 collected successfully"
        }
        """
        reservation = self.get_object()
        
        # Validate deposit requirements
        if not reservation.deposit_required:
            return Response(
                {'error': 'No deposit required for this reservation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if reservation.deposit_paid:
            return Response(
                {'error': 'Deposit already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get and validate amount
        amount_str = request.data.get('amount')
        if not amount_str:
            return Response(
                {'error': 'Deposit amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            amount = Decimal(str(amount_str))
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid amount format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate against required deposit amount
        if reservation.deposit_amount and amount != reservation.deposit_amount:
            return Response(
                {
                    'error': f'Deposit amount must be ${reservation.deposit_amount}',
                    'required_amount': str(reservation.deposit_amount),
                    'provided_amount': str(amount)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get payment method
        payment_method_id = request.data.get('payment_method')
        if not payment_method_id:
            return Response(
                {'error': 'Payment method is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from pos.models import PaymentMethod
            payment_method = PaymentMethod.objects.get(id=payment_method_id, is_active=True)
        except PaymentMethod.DoesNotExist:
            return Response(
                {'error': 'Invalid payment method'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create deposit record
        from pos.models import Deposit
        with transaction.atomic():
            deposit = Deposit.objects.create(
                guest=reservation.guest,
                reservation=reservation,
                amount=amount,
                status='paid',
                payment_method=payment_method.code,
                transaction_id=request.data.get('transaction_id', ''),
                reference=request.data.get('reference', ''),
                notes=request.data.get('notes', ''),
                collected_by=request.user if request.user.is_authenticated else None
            )
            
            # Update reservation
            reservation.deposit_paid = True
            reservation.deposit_paid_at = timezone.now()
            reservation.save(update_fields=['deposit_paid', 'deposit_paid_at'])
        
        return Response({
            'success': True,
            'deposit_id': deposit.id,
            'amount': str(deposit.amount),
            'status': deposit.status,
            'reservation_id': reservation.id,
            'collected_at': deposit.collected_at,
            'message': f'Deposit of ${deposit.amount} collected successfully'
        }, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["get"], url_path="deposit-status")
    def deposit_status(self, request, pk=None):
        """
        Get deposit status for reservation
        
        Endpoint: GET /api/reservations/{id}/deposit-status/
        """
        reservation = self.get_object()
        
        return response.Response({
            'reservation_id': reservation.id,
            'deposit_required': reservation.deposit_required,
            'deposit_amount': str(reservation.deposit_amount) if reservation.deposit_amount else None,
            'deposit_paid': reservation.deposit_paid,
            'deposit_paid_at': reservation.deposit_paid_at,
            'deposit_status': reservation.deposit_status,
            'can_pay_deposit': reservation.can_pay_deposit(),
            'reservation_status': reservation.status
        })

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user

        return get_objects_for_user(user, 'reservations.view_reservation', qs)

    @decorators.action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        obj = self.get_object()
        from guardian.shortcuts import get_users_with_perms

        users = get_users_with_perms(obj, attach_perms=True, with_superusers=False)
        result = {u.username: perms for u, perms in users.items()}
        return response.Response(result)

    @decorators.action(detail=True, methods=["post"], url_path="grant", permission_classes=[ObjectPermissionsOrReadOnly])
    def grant(self, request, pk=None):
        reservation = self.get_object()
        from guardian.shortcuts import assign_perm
        username = request.data.get("username")
        perm = request.data.get("perm", "change_reservation")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return response.Response({"detail": "User not found"}, status=status.HTTP_400_BAD_REQUEST)
        assign_perm(perm, user, reservation)
        return response.Response({"granted": perm, "to": username})

    @decorators.action(detail=True, methods=["post"], url_path="revoke", permission_classes=[ObjectPermissionsOrReadOnly])
    def revoke(self, request, pk=None):
        reservation = self.get_object()
        from guardian.shortcuts import remove_perm
        username = request.data.get("username")
        perm = request.data.get("perm", "change_reservation")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return response.Response({"detail": "User not found"}, status=status.HTTP_400_BAD_REQUEST)
        remove_perm(perm, user, reservation)
        return response.Response({"revoked": perm, "from": username})
    
    @decorators.action(detail=True, methods=["post"], url_path="mark-clean")
    def mark_clean(self, request, pk=None):
        reservation = self.get_object()
        if not getattr(reservation, 'location_id', None):
            return response.Response({"error": "Reservation has no location"}, status=status.HTTP_400_BAD_REQUEST)
        loc = reservation.location
        loc.is_clean = True
        loc.save(update_fields=["is_clean"])
        return response.Response({"location_id": loc.id, "is_clean": loc.is_clean})

    @decorators.action(detail=True, methods=["post"], url_path="mark-dirty")
    def mark_dirty(self, request, pk=None):
        reservation = self.get_object()
        if not getattr(reservation, 'location_id', None):
            return response.Response({"error": "Reservation has no location"}, status=status.HTTP_400_BAD_REQUEST)
        loc = reservation.location
        loc.is_clean = False
        loc.save(update_fields=["is_clean"])
        return response.Response({"location_id": loc.id, "is_clean": loc.is_clean})
        
    @decorators.action(detail=False, methods=["get"], url_path="availability")
    def availability(self, request):
        """Check if a location/employee/service is available at a given start time"""
        service_id = request.query_params.get("service")
        services_param = request.query_params.getlist("services") if hasattr(request.query_params, 'getlist') else None
        employee_id = request.query_params.get("employee")
        start_time = request.query_params.get("start")
        location_id = request.query_params.get("location")

        if not (service_id and start_time):
            return response.Response(
                {"error": "service and start are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: add your service duration lookup
        from services.models import Service
        try:
            if services_param:
                services_qs = Service.objects.filter(pk__in=services_param)
                services = list(services_qs)
                if not services:
                    return response.Response({"error": "Services not found"}, status=status.HTTP_404_NOT_FOUND)
                # use max duration among selected services
                duration_minutes = max([s.duration_minutes for s in services] or [60])
            else:
                service = Service.objects.get(pk=service_id)
                services = [service]
                duration_minutes = service.duration_minutes
        except Service.DoesNotExist:
            return response.Response({"error": "Service not found"}, status=status.HTTP_404_NOT_FOUND)

        # calculate end time
        from datetime import timedelta
        start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        # check conflicts
        conflicts = Reservation.objects.filter(
            start_time__lt=end_dt,
            end_time__gt=start_dt,
            status__in=[
                Reservation.STATUS_BOOKED,
                Reservation.STATUS_CHECKED_IN,
                Reservation.STATUS_IN_SERVICE,
            ],
        )

        if employee_id:
            # Filter by the reservation's employee (no employee on ReservationService)
            conflicts = conflicts.filter(employee_id=employee_id)
        if location_id:
            conflicts = conflicts.filter(location_id=location_id)

        # Exclude current reservation when editing
        exclude_reservation = request.query_params.get("exclude_reservation")
        if exclude_reservation:
            try:
                conflicts = conflicts.exclude(pk=int(exclude_reservation))
            except Exception:
                pass

        # Block out-of-service and validate compatibility/capacity
        if location_id:
            try:
                loc = Location.objects.get(pk=location_id)
            except Location.DoesNotExist:
                return response.Response({"available": False, "reason": "invalid_location"})

            if getattr(loc, 'is_out_of_service', False):
                return response.Response({"available": False, "reason": "out_of_service"})

            # service compatibility: service must be allowed in location
            try:
                compat_all = all([s.locations.filter(pk=loc.pk).exists() for s in services])
            except Exception:
                compat_all = False
            if not compat_all:
                return response.Response({"available": False, "reason": "incompatible_room"})

            # capacity-aware availability
            overlap_count = conflicts.count()
            capacity = getattr(loc, 'capacity', 1) or 1
            is_available = overlap_count < capacity
            payload = {"available": is_available, "overlaps": overlap_count, "capacity": capacity}
            if not is_available:
                payload.update({"reason": "capacity_reached"})
            return response.Response(payload)

        return response.Response({"available": not conflicts.exists()})

    @decorators.action(detail=False, methods=["post"], url_path="conflict-check")
    def conflict_check(self, request):
        """Check if a new reservation conflicts with existing ones"""
        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        location_id = request.data.get("location")
        exclude_reservation = request.data.get("exclude_reservation")
        service_id = request.data.get("service")
        services_list = request.data.get("services")

        if not (start_time and end_time and location_id):
            return response.Response(
                {"error": "start_time, end_time, and location are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = timezone.datetime.fromisoformat(end_time.replace("Z", "+00:00"))

        conflicts = Reservation.objects.filter(
            location_id=location_id,
            start_time__lt=end_dt,
            end_time__gt=start_dt,
            status__in=[
                Reservation.STATUS_BOOKED,
                Reservation.STATUS_CHECKED_IN,
                Reservation.STATUS_IN_SERVICE,
            ],
        )
        if exclude_reservation:
            try:
                conflicts = conflicts.exclude(pk=int(exclude_reservation))
            except Exception:
                pass

        # Validate location & service compatibility and capacity-aware conflicts
        try:
            loc = Location.objects.get(pk=location_id)
        except Location.DoesNotExist:
            return response.Response({"conflict": True, "reason": "invalid_location"})

        if getattr(loc, 'is_out_of_service', False):
            return response.Response({"conflict": True, "reason": "out_of_service"})

        # service compatibility: all services must be allowed in location
        try:
            from services.models import Service
            if services_list and isinstance(services_list, list):
                svcs = Service.objects.filter(pk__in=services_list)
                if not all([s.locations.filter(pk=loc.pk).exists() for s in svcs]):
                    return response.Response({"conflict": True, "reason": "incompatible_room"})
            elif service_id:
                svc = Service.objects.get(pk=int(service_id))
                if not svc.locations.filter(pk=loc.pk).exists():
                    return response.Response({"conflict": True, "reason": "incompatible_room"})
        except Service.DoesNotExist:
            return response.Response({"conflict": True, "reason": "invalid_service"})
        except Exception:
            return response.Response({"conflict": True, "reason": "invalid_service"})

        overlap_count = conflicts.count()
        capacity = getattr(loc, 'capacity', 1) or 1
        is_conflict = overlap_count >= capacity
        payload = {"conflict": is_conflict, "overlaps": overlap_count, "capacity": capacity}
        if is_conflict:
            payload.update({"reason": "capacity_reached"})
        return response.Response(payload)