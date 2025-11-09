from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Sum, Count, Avg, F
from decimal import Decimal
from django.core.exceptions import ValidationError

from .models import Invoice, InvoiceItem, Payment, PaymentMethod, Refund, Deposit
from .serializers import (
    InvoiceSerializer,
    InvoiceListSerializer,
    InvoiceItemSerializer,
    PaymentSerializer,
    PaymentMethodSerializer,
    ProcessPaymentSerializer,
    RefundSerializer,
    RefundModelSerializer,
    DepositSerializer,
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for invoice management
    
    Provides:
    - Standard CRUD operations
    - Payment processing
    - Refunds
    - Statistics
    - Search and filtering
    """
    
    queryset = Invoice.objects.all().prefetch_related(
        'items',
        'items__service',
        'payments',
        'payments__payment_method'
    ).select_related(
        'guest',
        'reservation',
        'created_by'
    )
    
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'guest__first_name', 'guest__last_name', 'guest__email']
    ordering_fields = ['date', 'total', 'status', 'invoice_number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        """
        Use different serializers for different actions
        
        - List view: Lightweight serializer (better performance)
        - Detail view: Full serializer with nested data
        """
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer
    
    def get_queryset(self):
        """
        Filter invoices based on query parameters
        
        Supported filters:
        - guest: Filter by guest ID
        - reservation: Filter by reservation ID
        - status: Filter by status
        - start_date: Invoices on or after this date
        - end_date: Invoices on or before this date
        - search: Search invoice number, guest name, email
        - min_amount: Minimum total amount
        - max_amount: Maximum total amount
        - has_balance: Only invoices with outstanding balance
        - is_overdue: Only overdue invoices
        
        Examples:
        GET /api/invoices/?guest=15
        GET /api/invoices/?status=pending
        GET /api/invoices/?start_date=2025-01-01&end_date=2025-01-31
        GET /api/invoices/?has_balance=true
        GET /api/invoices/?search=john
        """
        queryset = super().get_queryset()
        
        # Filter by guest
        guest_id = getattr(self.request, 'query_params', {}).get('guest')
        if guest_id:
            queryset = queryset.filter(guest_id=guest_id)
        
        # Filter by reservation
        reservation_id = getattr(self.request, 'query_params', {}).get('reservation')
        if reservation_id:
            queryset = queryset.filter(reservation_id=reservation_id)
        
        # Filter by status
        status_param = getattr(self.request, 'query_params', {}).get('status')
        if status_param:
            # Support comma-separated statuses
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        # Filter by date range
        start_date = getattr(self.request, 'query_params', {}).get('start_date')
        end_date = getattr(self.request, 'query_params', {}).get('end_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Filter by amount range
        min_amount = getattr(self.request, 'query_params', {}).get('min_amount')
        max_amount = getattr(self.request, 'query_params', {}).get('max_amount')
        if min_amount:
            queryset = queryset.filter(total__gte=Decimal(min_amount))
        if max_amount:
            queryset = queryset.filter(total__lte=Decimal(max_amount))
        
        # Filter invoices with balance
        has_balance = getattr(self.request, 'query_params', {}).get('has_balance')
        if has_balance and has_balance.lower() == 'true':
            queryset = queryset.filter(balance_due__gt=0)
        
        # Filter overdue invoices
        is_overdue = getattr(self.request, 'query_params', {}).get('is_overdue')
        if is_overdue and is_overdue.lower() == 'true':
            queryset = queryset.filter(
                status='overdue'
            ) | queryset.filter(
                due_date__lt=timezone.now().date(),
                balance_due__gt=0,
                status__in=['pending', 'partial']
            )
        
        return queryset
    
    def perform_create(self, serializer):
        """
        Hook to set created_by when creating invoice
        """
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """
        Process a payment for this invoice
        
        Endpoint: POST /api/invoices/{id}/process-payment/
        
        Request body:
        {
            "amount": "108.00",
            "payment_method": 2,
            "payment_type": "full",
            "reference": "VISA-4532",
            "transaction_id": "TXN-123456",
            "notes": "Paid by Visa ending in 4532"
        }
        
        Process:
        1. Validate request data
        2. Get invoice
        3. Check if invoice can accept payments
        4. Validate amount against balance
        5. Create payment record
        6. Update invoice totals (automatic via signals)
        7. Update guest loyalty points (automatic via signals)
        8. Return success response
        
        Response (success):
        {
            "success": true,
            "payment_id": 1,
            "amount_paid": "108.00",
            "invoice_total": "108.00",
            "amount_previously_paid": "0.00",
            "total_paid": "108.00",
            "balance_due": "0.00",
            "invoice_status": "paid",
            "payment_status": "completed",
            "message": "Payment of $108.00 processed successfully"
        }
        
        Response (error):
        {
            "error": "Payment amount cannot exceed balance due of $108.00"
        }
        """
        invoice = self.get_object()

        # Validate request data
        serializer = ProcessPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        payment_method = serializer.validated_data['payment_method']
        payment_type = serializer.validated_data['payment_type']
        reference = serializer.validated_data.get('reference', '')
        transaction_id = serializer.validated_data.get('transaction_id', '')
        notes = serializer.validated_data.get('notes', '')
        idempotency_key = serializer.validated_data.get('idempotency_key', '')
        requested_version = request.data.get('version', None)

        # Idempotency short-circuit
        if idempotency_key:
            existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                invoice.refresh_from_db()
                return Response({
                    'success': True,
                    'duplicate': True,
                    'payment_id': existing.id,
                    'amount_paid': str(existing.amount),
                    'invoice_total': str(invoice.total),
                    'amount_previously_paid': str(invoice.amount_paid - existing.amount),
                    'total_paid': str(invoice.amount_paid),
                    'balance_due': str(invoice.balance_due),
                    'invoice_status': invoice.status,
                    'payment_status': existing.status,
                    'message': 'Payment already processed (idempotency key matched)'
                })

        # Optimistic locking
        if requested_version is not None and invoice.version != requested_version:
            return Response(
                {
                    'error': 'Invoice was modified by another user. Please refresh.',
                    'conflict': True,
                    'current_version': invoice.version,
                    'requested_version': requested_version,
                },
                status=status.HTTP_409_CONFLICT
            )

        # Check if invoice can accept payments
        if not invoice.can_be_paid():
            return Response(
                {
                    'error': f'Cannot process payment for {invoice.status} invoice',
                    'invoice_status': invoice.status,
                    'balance_due': str(invoice.balance_due)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Guard: prevent regular/manual payments when guest has un-applied deposits
        # Require using Apply Deposit endpoints instead to avoid double-crediting
        if payment_type in ['regular', 'manual']:
            from .models import Deposit
            from django.db.models import F as _F
            un_applied = Deposit.objects.filter(
                guest=invoice.guest,
                status__in=['pending', 'collected', 'partially_applied'],
            ).filter(amount__gt=_F('amount_applied'))

            if un_applied.exists():
                # Optionally compute total remaining for message clarity
                from decimal import Decimal as _D
                total_remaining = _D('0.00')
                for d in un_applied:
                    total_remaining += (d.amount - d.amount_applied)
                return Response(
                    {
                        'error': (
                            'Guest has un-applied deposit(s). Use Apply Deposit instead of a regular payment.'
                        ),
                        'total_deposit_remaining': str(total_remaining),
                        'hint': 'POST /api/invoices/{id}/apply_deposit/ with {"deposit_id": ..., "amount": ...}'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate amount against balance
        if amount > invoice.balance_due:
            return Response(
                {
                    'error': f'Payment amount ${amount} cannot exceed balance due of ${invoice.balance_due}',
                    'balance_due': str(invoice.balance_due),
                    'amount_requested': str(amount)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        previous_amount_paid = invoice.amount_paid

        # Create payment within transaction
        with transaction.atomic():
            # Lock invoice row for concurrent safety
            invoice_locked = Invoice.objects.select_for_update().get(pk=invoice.pk)

            payment = Payment.objects.create(
                invoice=invoice_locked,
                method=payment_method.code,
                payment_method=payment_method,
                payment_type=payment_type,
                amount=amount,
                transaction_id=transaction_id,
                reference=reference,
                status='completed',
                notes=notes,
                processed_by=request.user,
                idempotency_key=idempotency_key or None
            )

            # Refresh locked invoice
            invoice_locked.refresh_from_db()

        # Refresh main invoice instance
        invoice.refresh_from_db()

        return Response({
            'success': True,
            'payment_id': payment.id,
            'amount_paid': str(payment.amount),
            'invoice_total': str(invoice.total),
            'amount_previously_paid': str(previous_amount_paid),
            'total_paid': str(invoice.amount_paid),
            'balance_due': str(invoice.balance_due),
            'invoice_status': invoice.status,
            'payment_status': payment.status,
            'loyalty_points_earned': int(payment.amount),
            'version': invoice.version,
            'message': f'Payment of ${payment.amount} processed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """
        Process a refund for this invoice
        
        Endpoint: POST /api/invoices/{id}/refund/
        
        Request body:
        {
            "amount": "50.00",
            "reason": "Guest cancelled - partial refund per policy",
            "payment_method": "credit_card",
            "notes": "Refunded to original payment method"
        }
        
        Process:
        1. Validate request data
        2. Check if invoice can be refunded
        3. Validate refund amount against amount paid
        4. Create refund payment (negative amount)
        5. Update invoice totals
        6. Deduct guest loyalty points
        7. Return success response
        
        Response (success):
        {
            "success": true,
            "refund_id": 2,
            "refund_amount": "50.00",
            "remaining_paid": "58.00",
            "balance_due": "50.00",
            "invoice_status": "partial",
            "message": "Refund of $50.00 processed successfully"
        }
        """
        invoice = self.get_object()
        
        # Validate request data
        serializer = RefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']
        payment_method = serializer.validated_data.get('payment_method', 'refund')
        notes = serializer.validated_data.get('notes', '')
        payment_to_refund = serializer.validated_data.get('payment_id')
        requested_version = request.data.get('version', None)
        
        # Map payment method to refund method
        refund_method_mapping = {
            'cash': 'cash',
            'credit_card': 'original_payment',
            'debit_card': 'original_payment',
            'bank_transfer': 'bank_transfer',
            'store_credit': 'store_credit',
        }
        refund_method = refund_method_mapping.get(payment_method, 'original_payment')

        # Optimistic locking
        if requested_version is not None and invoice.version != requested_version:
            return Response(
                {
                    'error': 'Invoice was modified by another user. Please refresh.',
                    'conflict': True,
                    'current_version': invoice.version,
                    'requested_version': requested_version,
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Check if invoice can be refunded
        if not invoice.can_be_refunded():
            return Response(
                {
                    'error': 'This invoice cannot be refunded',
                    'invoice_status': invoice.status,
                    'amount_paid': str(invoice.amount_paid)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate refund amount
        if amount > invoice.amount_paid:
            return Response(
                {
                    'error': f'Refund amount ${amount} cannot exceed amount paid ${invoice.amount_paid}',
                    'amount_paid': str(invoice.amount_paid),
                    'refund_requested': str(amount)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create refund within transaction (no negative payments)
        with transaction.atomic():
            invoice_locked = Invoice.objects.select_for_update().get(pk=invoice.pk)

            from .models import Refund
            refund = Refund.objects.create(
                invoice=invoice_locked,
                original_payment=payment_to_refund if payment_to_refund else None,
                amount=amount,
                reason=reason,
                refund_method=refund_method,
                status='processed',
                requested_by=request.user,
                approved_by=request.user,
                processed_by=request.user,
                processed_at=timezone.now(),
            )

            # Recalculate totals after refund is processed
            invoice_locked.refresh_from_db()
            invoice_locked.recalculate_totals()
        
        # Refresh invoice
        invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'refund_id': refund.id,
            'refund_amount': str(amount),
            'refund_reason': reason,
            'remaining_paid': str(invoice.amount_paid),
            'balance_due': str(invoice.balance_due),
            'invoice_status': invoice.status,
            'loyalty_points_deducted': int(amount),
            'version': invoice.version,
            'message': f'Refund of ${amount} processed successfully'
        })
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """
        Manually mark invoice as paid
        
        Creates a payment for the remaining balance
        Useful for cash payments, comp'd services, etc.
        
        Endpoint: POST /api/invoices/{id}/mark-paid/
        
        Request body:
        {
            "method": "cash",
            "notes": "Paid in full - cash"
        }
        
        Response:
        {
            "success": true,
            "payment_id": 3,
            "amount": "108.00",
            "message": "Invoice marked as paid"
        }
        """
        invoice = self.get_object()
        
        # Check if already paid
        if invoice.balance_due <= 0:
            return Response(
                {
                    'error': 'Invoice is already paid',
                    'status': invoice.status,
                    'balance_due': str(invoice.balance_due)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        method = request.data.get('method', 'cash')
        notes = request.data.get('notes', 'Marked as paid')
        
        # Create payment for remaining balance with row lock
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

            if invoice.balance_due <= 0:
                return Response(
                    {
                        'error': 'Invoice is already paid',
                        'status': invoice.status,
                        'balance_due': str(invoice.balance_due)
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            payment = Payment.objects.create(
                invoice=invoice,
                method=method,
                payment_type='full',
                amount=invoice.balance_due,
                status='completed',
                notes=notes,
                processed_by=request.user
            )
        
        invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'payment_id': payment.id,
            'amount': str(payment.amount),
            'invoice_status': invoice.status,
            'message': 'Invoice marked as paid'
        })
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel an invoice
        
        Can only cancel if no payments have been made
        If payments exist, must refund first
        
        Endpoint: POST /api/invoices/{id}/cancel/
		
		Request body:
        {
            "reason": "Guest cancelled appointment"
        }
        
        Response:
        {
            "success": true,
            "message": "Invoice cancelled successfully"
        }
        """
        invoice = self.get_object()
        
        # Check if payments have been made
        if invoice.amount_paid > 0:
            return Response(
                {
                    'error': 'Cannot cancel invoice with payments. Please refund payments first.',
                    'amount_paid': str(invoice.amount_paid)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', '')
        requested_version = request.data.get('version', None)

        # Optimistic locking
        if requested_version is not None and invoice.version != requested_version:
            return Response(
                {
                    'error': 'Invoice was modified by another user. Please refresh.',
                    'conflict': True,
                    'current_version': invoice.version,
                    'requested_version': requested_version,
                },
                status=status.HTTP_409_CONFLICT
            )

        # Cancel invoice with row lock and bump version
        with transaction.atomic():
            locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
            locked.status = 'cancelled'
            if reason:
                locked.notes = f"{locked.notes}\n\nCancelled: {reason}".strip()
            locked.version = (locked.version or 0) + 1
            locked.save(update_fields=['status', 'notes', 'version'])
            invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'invoice_status': invoice.status,
            'version': invoice.version,
            'message': 'Invoice cancelled successfully'
        })
    
    @action(detail=True, methods=['post'])
    def apply_discount(self, request, pk=None):
        """
        Apply discount to invoice with optimistic locking
        
        Endpoint: POST /api/invoices/{id}/apply-discount/
        
        Request body:
        {
            "discount": "10.00",
            "reason": "Loyalty member - 10% off",
            "version": 1
        }
        
        Response:
        {
            "success": true,
            "version": 2,
            "previous_total": "108.00",
            "discount_applied": "10.00",
            "new_total": "98.00",
            "new_balance_due": "98.00",
            "message": "Discount of $10.00 applied"
        }
        """
        invoice = self.get_object()
        
        # Get request data
        discount_amount = Decimal(request.data.get('discount', '0'))
        reason = request.data.get('reason', '')
        requested_version = request.data.get('version', None)
        
        # Validate discount amount
        if discount_amount <= 0:
            return Response(
                {'error': 'Discount amount must be greater than zero'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if discount_amount > invoice.subtotal:
            return Response(
                {'error': f'Discount cannot exceed subtotal of ${invoice.subtotal}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Optimistic locking check
        if requested_version is not None and invoice.version != requested_version:
            return Response(
                {
                    'error': 'Invoice was modified by another user. Please refresh.',
                    'conflict': True,
                    'current_version': invoice.version,
                    'requested_version': requested_version,
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Apply discount with row lock and version bump
        with transaction.atomic():
            locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
            previous_total = locked.total
            
            locked.discount = discount_amount
            if reason:
                locked.notes = f"{locked.notes}\n\nDiscount: {reason}".strip()
            
            # Recalculate totals
            locked.total = locked.subtotal + locked.tax + locked.service_charge - locked.discount
            locked.balance_due = locked.total - locked.amount_paid
            locked.version = (locked.version or 0) + 1
            locked.save(update_fields=['discount', 'notes', 'total', 'balance_due', 'version'])
            
            invoice.refresh_from_db()
        
        return Response({
            'success': True,
            'version': invoice.version,
            'previous_total': str(previous_total),
            'discount_applied': str(discount_amount),
            'new_total': str(invoice.total),
            'new_balance_due': str(invoice.balance_due),
            'message': f'Discount of ${discount_amount} applied'
        })
    
    @action(detail=True, methods=['get'])
    def payment_history(self, request, pk=None):
        """
        Get complete payment history for this invoice
        
        Endpoint: GET /api/invoices/{id}/payment-history/
        
        Response:
        {
            "invoice_number": "INV-000042",
            "guest_name": "John Smith",
            "total": "108.00",
            "amount_paid": "108.00",
            "balance_due": "0.00",
            "status": "paid",
            "payment_count": 2,
            "payments": [
                {
                    "id": 1,
                    "amount": "50.00",
                    "method": "credit_card",
                    "payment_type": "partial",
                    "payment_date": "2025-01-15T14:00:00Z",
                    "status": "completed",
                    "processed_by_name": "Jane Doe",
                    "notes": "First payment"
                },
                {
                    "id": 2,
                    "amount": "58.00",
                    "method": "cash",
                    "payment_type": "full",
                    "payment_date": "2025-01-15T15:00:00Z",
                    "status": "completed",
                    "processed_by_name": "Jane Doe",
                    "notes": "Remaining balance"
                }
            ]
        }
        """
        invoice = self.get_object()
        payments = invoice.payments.all().order_by('-payment_date')
        serializer = PaymentSerializer(payments, many=True)
        
        return Response({
            'invoice_number': invoice.invoice_number,
            'guest_name': f"{invoice.guest.first_name} {invoice.guest.last_name}",
            'total': str(invoice.total),
            'amount_paid': str(invoice.amount_paid),
            'balance_due': str(invoice.balance_due),
            'status': invoice.status,
            'payment_count': payments.count(),
            'payments': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get invoice summary statistics
        
        Endpoint: GET /api/invoices/summary/
        
        Optional query parameters:
        - start_date: Filter from this date
        - end_date: Filter to this date
        - guest: Filter by guest ID
        
        Response:
        {
            "total_invoices": 150,
            "total_amount": "45000.00",
            "total_paid": "42000.00",
            "total_outstanding": "3000.00",
            "average_invoice": "300.00",
            "by_status": {
                "pending": 10,
                "partial": 5,
                "paid": 130,
                "overdue": 3,
                "cancelled": 2
            },
            "pending_count": 10,
            "paid_count": 130,
            "overdue_count": 3,
            "partial_count": 5,
            "cancelled_count": 2,
            "refunded_count": 0
        }
        """
        queryset = self.get_queryset()
        
        # Calculate aggregates
        summary_data = queryset.aggregate(
            total_invoices=Count('id'),
            total_amount=Sum('total'),
            total_paid=Sum('amount_paid'),
            total_outstanding=Sum('balance_due'),
            average_invoice=Avg('total'),
            pending_count=Count('id', filter=Q(status='pending')),
            paid_count=Count('id', filter=Q(status='paid')),
            overdue_count=Count('id', filter=Q(status='overdue')),
            partial_count=Count('id', filter=Q(status='partial')),
            cancelled_count=Count('id', filter=Q(status='cancelled')),
            refunded_count=Count('id', filter=Q(status='refunded')),
            draft_count=Count('id', filter=Q(status='draft')),
        )
        
        # Count by status
        by_status = {}
        for status_choice, _ in Invoice.STATUS_CHOICES:
            by_status[status_choice] = queryset.filter(status=status_choice).count()
        
        # Format response
        return Response({
            'total_invoices': summary_data['total_invoices'] or 0,
            'total_amount': str(summary_data['total_amount'] or Decimal('0.00')),
            'total_paid': str(summary_data['total_paid'] or Decimal('0.00')),
            'total_outstanding': str(summary_data['total_outstanding'] or Decimal('0.00')),
            'average_invoice': str(summary_data['average_invoice'] or Decimal('0.00')),
            'by_status': by_status,
            'pending_count': summary_data['pending_count'] or 0,
            'paid_count': summary_data['paid_count'] or 0,
            'overdue_count': summary_data['overdue_count'] or 0,
            'partial_count': summary_data['partial_count'] or 0,
            'cancelled_count': summary_data['cancelled_count'] or 0,
            'refunded_count': summary_data['refunded_count'] or 0,
            'draft_count': summary_data['draft_count'] or 0,
        })
    
    @action(detail=True, methods=['post'])
    def send_to_guest(self, request, pk=None):
        """
        Send invoice to guest via email
        
        Endpoint: POST /api/invoices/{id}/send-to-guest/
        
        Request body:
        {
            "email": "guest@example.com",  // Optional, defaults to guest's email
            "message": "Thank you for visiting!"  // Optional custom message
        }
        
        Response:
        {
            "success": true,
            "sent_to": "guest@example.com",
            "message": "Invoice sent successfully"
        }
        """
        invoice = self.get_object()
        
        # Get email address
        email = request.data.get('email', invoice.guest.email)
        custom_message = request.data.get('message', '')
        
        if not email:
            return Response(
                {'error': 'Guest email address is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Implement email sending logic
        # This would integrate with your email service
        # For now, just return success
        
        return Response({
            'success': True,
            'sent_to': email,
            'message': 'Invoice sent successfully'
        })

    @action(detail=True, methods=['get'])
    def refund_history(self, request, pk=None):
        """
        Get complete refund history for this invoice
        Endpoint: GET /api/invoices/{id}/refund-history/
        """
        invoice = self.get_object()
        refunds = invoice.refunds.all().order_by('-created_at')
        data = RefundModelSerializer(refunds, many=True).data
        total_refunded = invoice.refunds.filter(status='processed').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        return Response({
            'invoice_number': invoice.invoice_number,
            'guest_name': f"{invoice.guest.first_name} {invoice.guest.last_name}",
            'total': str(invoice.total),
            'amount_paid': str(invoice.amount_paid),
            'total_refunded': str(total_refunded),
            'refund_count': refunds.count(),
            'refunds': data,
        })

    @action(detail=True, methods=['get'])
    def available_deposits(self, request, pk=None):
        """
        Get available deposits for this invoice's guest
        
        GET /api/invoices/{id}/available_deposits/
        """
        invoice = self.get_object()
        from .models import Deposit
        
        deposits = Deposit.objects.filter(
            guest=invoice.guest,
            status__in=['pending', 'collected', 'partially_applied']
        ).order_by('-collected_at')
        
        from .serializers import DepositSerializer
        # Filter deposits that have remaining amount > 0
        available_deposits = [d for d in deposits if d.remaining_amount > 0]
        serializer = DepositSerializer(available_deposits, many=True)
        
        from decimal import Decimal
        total_available = sum((d.remaining_amount for d in available_deposits), Decimal('0.00'))
        
        return Response({
            'invoice_id': invoice.id,
            'guest_name': f"{invoice.guest.first_name} {invoice.guest.last_name}",
            'available_deposits_count': len(available_deposits),
            'total_available_amount': str(total_available),
            'deposits': serializer.data
        })
    
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """
        Generate and download invoice as PDF
        
        Endpoint: GET /api/invoices/{id}/pdf/
        
        Returns:
            PDF file as binary response with Content-Type: application/pdf
        
        Example:
            GET /api/invoices/42/pdf/
            Response: PDF binary data
        """
        from django.http import HttpResponse
        from .pdf_generator import generate_invoice_pdf
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            invoice = self.get_object()
            
            # Generate PDF
            pdf_buffer = generate_invoice_pdf(invoice)
            
            # Create response
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
            response['Content-Length'] = len(pdf_buffer.getvalue())
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating PDF for invoice {pk}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to generate PDF',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for payments
    
    Payments are created through invoice actions, not directly
    This viewset is for viewing and reporting only
    
    Endpoints:
    - GET /api/payments/          - List all payments
    - GET /api/payments/{id}/     - Get payment details
    - GET /api/payments/summary/  - Get payment statistics
    """
    
    queryset = Payment.objects.all().select_related(
        'invoice',
        'invoice__guest',
        'payment_method',
        'processed_by'
    )
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['payment_date', 'amount']
    ordering = ['-payment_date']
    
    def get_queryset(self):
        """
        Filter payments based on query parameters
        
        Supported filters:
        - invoice: Filter by invoice ID
        - guest: Filter by guest ID
        - status: Filter by status
        - method: Filter by payment method
        - start_date: Payments on or after this date
        - end_date: Payments on or before this date
        - min_amount: Minimum payment amount
        - max_amount: Maximum payment amount
        - payment_type: Filter by type (full, partial, deposit, refund)
        - processed_by: Filter by staff member who processed
        
        Examples:
        GET /api/payments/?invoice=42
        GET /api/payments/?guest=15
        GET /api/payments/?status=completed
        GET /api/payments/?method=credit_card
        GET /api/payments/?payment_type=refund
        GET /api/payments/?start_date=2025-01-01&end_date=2025-01-31
        """
        queryset = super().get_queryset()
        
        # Filter by invoice
        invoice_id = getattr(self.request, 'query_params', {}).get('invoice')
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        
        # Filter by guest
        guest_id = getattr(self.request, 'query_params', {}).get('guest')
        if guest_id:
            queryset = queryset.filter(invoice__guest_id=guest_id)
        
        # Filter by status
        status_param = getattr(self.request, 'query_params', {}).get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Filter by method
        method = getattr(self.request, 'query_params', {}).get('method')
        if method:
            queryset = queryset.filter(method=method)
        
        # Filter by payment type
        payment_type = getattr(self.request, 'query_params', {}).get('payment_type')
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)
        
        # Filter by date range
        start_date = getattr(self.request, 'query_params', {}).get('start_date')
        end_date = getattr(self.request, 'query_params', {}).get('end_date')
        if start_date:
            queryset = queryset.filter(payment_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(payment_date__lte=end_date)
        
        # Filter by amount range
        min_amount = getattr(self.request, 'query_params', {}).get('min_amount')
        max_amount = getattr(self.request, 'query_params', {}).get('max_amount')
        if min_amount:
            queryset = queryset.filter(amount__gte=Decimal(min_amount))
        if max_amount:
            queryset = queryset.filter(amount__lte=Decimal(max_amount))
        
        # Filter by processor
        processed_by = getattr(self.request, 'query_params', {}).get('processed_by')
        if processed_by:
            queryset = queryset.filter(processed_by_id=processed_by)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get payment summary statistics
        
        Endpoint: GET /api/payments/summary/
        
        Response:
        {
            "total_payments": 250,
            "total_amount": "45000.00",
            "total_refunds": "2000.00",
            "net_revenue": "43000.00",
            "average_payment": "180.00",
            "by_method": {
                "cash": "15000.00",
                "credit_card": "25000.00",
                "mobile_payment": "5000.00"
            },
            "by_status": {
                "completed": 245,
                "pending": 3,
                "failed": 2
            },
            "completed_count": 245,
            "pending_count": 3,
            "failed_count": 2
        }
        """
        queryset = self.get_queryset()
        
        # Calculate aggregates
        summary_data = queryset.aggregate(
            total_payments=Count('id'),
            total_amount=Sum('amount', filter=Q(status='completed', amount__gt=0)),
            total_refunds=Sum('amount', filter=Q(payment_type='refund', status='completed')),
            average_payment=Avg('amount', filter=Q(status='completed', amount__gt=0)),
            completed_count=Count('id', filter=Q(status='completed')),
            pending_count=Count('id', filter=Q(status='pending')),
            failed_count=Count('id', filter=Q(status='failed')),
            refunded_count=Count('id', filter=Q(status='refunded')),
        )
        
        # Calculate net revenue
        total_amount = summary_data['total_amount'] or Decimal('0.00')
        total_refunds = abs(summary_data['total_refunds'] or Decimal('0.00'))
        net_revenue = total_amount - total_refunds
        
        # Group by payment method
        by_method = {}
        for method_choice in queryset.values_list('method', flat=True).distinct():
            method_total = queryset.filter(
                method=method_choice,
                status='completed',
                amount__gt=0
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            by_method[method_choice] = str(method_total)
        
        # Group by status
        by_status = {}
        for status_choice, _ in Payment.PAYMENT_STATUS_CHOICES:
            by_status[status_choice] = queryset.filter(status=status_choice).count()
        
        return Response({
            'total_payments': summary_data['total_payments'] or 0,
            'total_amount': str(total_amount),
            'total_refunds': str(total_refunds),
            'net_revenue': str(net_revenue),
            'average_payment': str(summary_data['average_payment'] or Decimal('0.00')),
            'by_method': by_method,
            'by_status': by_status,
            'completed_count': summary_data['completed_count'] or 0,
            'pending_count': summary_data['pending_count'] or 0,
            'failed_count': summary_data['failed_count'] or 0,
            'refunded_count': summary_data['refunded_count'] or 0,
        })
    
    @action(detail=False, methods=['get'])
    def daily_report(self, request):
        """
        Get daily payment report
        
        Endpoint: GET /api/payments/daily-report/?date=2025-01-15
        
        Response:
        {
            "date": "2025-01-15",
            "total_payments": 25,
            "total_amount": "4500.00",
            "total_refunds": "200.00",
            "net_revenue": "4300.00",
            "by_method": {...},
            "by_hour": [
                {"hour": 9, "count": 2, "amount": "200.00"},
                {"hour": 10, "count": 5, "amount": "800.00"},
                ...
            ]
        }
        """
        date_param = request.query_params.get('date', timezone.now().date())
        
        # Parse date
        if isinstance(date_param, str):
            from django.utils.dateparse import parse_date
            date = parse_date(date_param)
        else:
            date = date_param
        
        # Filter payments for this date
        queryset = self.get_queryset().filter(
            payment_date__date=date
        )
        
        # Calculate aggregates
        summary = queryset.aggregate(
            total_payments=Count('id'),
            total_amount=Sum('amount', filter=Q(status='completed', amount__gt=0)),
            total_refunds=Sum('amount', filter=Q(payment_type='refund', status='completed')),
        )
        
        total_amount = summary['total_amount'] or Decimal('0.00')
        total_refunds = abs(summary['total_refunds'] or Decimal('0.00'))
        net_revenue = total_amount - total_refunds
        
        # Group by method
        by_method = {}
        for method in queryset.values_list('method', flat=True).distinct():
            method_total = queryset.filter(
                method=method,
                status='completed',
                amount__gt=0
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            by_method[method] = str(method_total)
        
        # Group by hour
        by_hour = []
        for hour in range(24):
            hour_payments = queryset.filter(
                payment_date__hour=hour,
                status='completed'
            )
            hour_count = hour_payments.count()
            hour_amount = hour_payments.aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            
            if hour_count > 0:
                by_hour.append({
                    'hour': hour,
                    'count': hour_count,
                    'amount': str(hour_amount)
                })
        
        return Response({
            'date': str(date),
            'total_payments': summary['total_payments'] or 0,
            'total_amount': str(total_amount),
            'total_refunds': str(total_refunds),
            'net_revenue': str(net_revenue),
            'by_method': by_method,
            'by_hour': by_hour
        })

    @action(detail=True, methods=['post'])
    def apply_deposit(self, request, pk=None):
        """
        Manually apply deposit to invoice
        
        POST /api/invoices/{id}/apply_deposit/
        Body: {"deposit_id": 123, "amount": 50.00}  # amount optional
        """
        invoice = self.get_object()
        from .models import Deposit
        
        deposit_id = request.data.get('deposit_id')
        if not deposit_id:
            return Response(
                {'error': 'deposit_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            deposit = Deposit.objects.get(id=deposit_id, guest=invoice.guest)
        except Deposit.DoesNotExist:
            return Response(
                {'error': 'Deposit not found or does not belong to this guest'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Optional amount parameter
        amount = request.data.get('amount')
        if amount:
            try:
                amount = Decimal(str(amount))
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid amount format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            payment = deposit.apply_to_invoice(invoice, amount)
            invoice.refresh_from_db()
            
            return Response({
                'success': True,
                'payment_id': payment.id,
                'amount_applied': str(payment.amount),
                'deposit_remaining': str(deposit.remaining_amount),
                'invoice_balance': str(invoice.balance_due),
                'message': f'Deposit of ${payment.amount} applied successfully'
            })
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    # URL alias to support hyphenated path if needed: /api/invoices/{id}/apply-deposit/
    @action(detail=True, methods=['post'], url_path='apply-deposit')
    def apply_deposit_alias(self, request, pk=None):
        return self.apply_deposit(request, pk)


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for payment methods
    
    Used to get list of available payment methods for dropdowns
    
    Endpoints:
    - GET /api/payment-methods/  - List active payment methods
    - GET /api/payment-methods/{id}/  - Get payment method details
    """
    
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['display_order', 'name']
