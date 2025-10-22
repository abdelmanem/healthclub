"""
New POS Views with Clean Architecture
Based on POS.md analysis and recommendations
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Sum, Count, Avg, F
from decimal import Decimal
from django.core.exceptions import ValidationError

from .models import Invoice, InvoiceItem, Payment, Refund, Deposit, PaymentMethod
from .serializers_new import (
    InvoiceSerializer,
    InvoiceListSerializer,
    InvoiceItemSerializer,
    PaymentSerializer,
    RefundSerializer,
    DepositSerializer,
    PaymentMethodSerializer,
    ProcessPaymentSerializer,
    ProcessRefundSerializer,
    ApplyDepositSerializer,
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for invoice management with clean architecture
    """
    
    queryset = Invoice.objects.all().prefetch_related(
        'items', 'items__service', 'payments', 'payments__payment_method',
        'refunds', 'refunds__original_payment'
    ).select_related(
        'guest', 'reservation', 'created_by'
    )
    
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'guest__first_name', 'guest__last_name', 'guest__email']
    ordering_fields = ['date', 'total', 'status', 'invoice_number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer
    
    def get_queryset(self):
        """Filter invoices based on query parameters"""
        queryset = super().get_queryset()
        
        # Filter by guest
        guest_id = self.request.query_params.get('guest')
        if guest_id:
            queryset = queryset.filter(guest_id=guest_id)
        
        # Filter by reservation
        reservation_id = self.request.query_params.get('reservation')
        if reservation_id:
            queryset = queryset.filter(reservation_id=reservation_id)
        
        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Filter by amount range
        min_amount = self.request.query_params.get('min_amount')
        max_amount = self.request.query_params.get('max_amount')
        if min_amount:
            queryset = queryset.filter(total__gte=min_amount)
        if max_amount:
            queryset = queryset.filter(total__lte=max_amount)
        
        # Filter by balance
        has_balance = self.request.query_params.get('has_balance')
        if has_balance == 'true':
            queryset = queryset.filter(balance_due__gt=0)
        elif has_balance == 'false':
            queryset = queryset.filter(balance_due=0)
        
        # Filter by overdue
        is_overdue = self.request.query_params.get('is_overdue')
        if is_overdue == 'true':
            queryset = queryset.filter(
                status='overdue'
            ).filter(
                due_date__lt=timezone.now().date()
            )
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """
        Process a payment for this invoice
        
        POST /api/invoices/{id}/process_payment/
        Body: {
            "amount": "50.00",
            "payment_method": 1,
            "payment_type": "regular",
            "transaction_id": "txn_123",
            "reference": "ref_456",
            "notes": "Payment notes",
            "idempotency_key": "unique_key"
        }
        """
        invoice = self.get_object()
        
        if not invoice.can_be_paid():
            return Response(
                {'error': 'Invoice cannot accept payments'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ProcessPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                payment = Payment.objects.create(
                    invoice=invoice,
                    payment_method_id=serializer.validated_data['payment_method'],
                    amount=serializer.validated_data['amount'],
                    payment_type=serializer.validated_data['payment_type'],
                    transaction_id=serializer.validated_data.get('transaction_id', ''),
                    reference=serializer.validated_data.get('reference', ''),
                    notes=serializer.validated_data.get('notes', ''),
                    idempotency_key=serializer.validated_data.get('idempotency_key'),
                    processed_by=request.user if request.user.is_authenticated else None
                )
                
                return Response({
                    'success': True,
                    'payment_id': payment.id,
                    'amount': str(payment.amount),
                    'status': payment.status,
                    'invoice_balance': str(invoice.balance_due),
                    'message': f'Payment of ${payment.amount} processed successfully'
                }, status=status.HTTP_201_CREATED)
                
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def process_refund(self, request, pk=None):
        """
        Process a refund for this invoice
        
        POST /api/invoices/{id}/process_refund/
        Body: {
            "amount": "25.00",
            "reason": "Guest cancellation",
            "refund_method": "original_payment",
            "original_payment": 123,
            "transaction_id": "ref_123",
            "reference": "ref_456",
            "notes": "Refund notes"
        }
        """
        invoice = self.get_object()
        
        if not invoice.can_be_refunded():
            return Response(
                {'error': 'Invoice cannot be refunded'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ProcessRefundSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                refund = Refund.objects.create(
                    invoice=invoice,
                    original_payment_id=serializer.validated_data.get('original_payment'),
                    amount=serializer.validated_data['amount'],
                    reason=serializer.validated_data['reason'],
                    refund_method=serializer.validated_data['refund_method'],
                    transaction_id=serializer.validated_data.get('transaction_id', ''),
                    reference=serializer.validated_data.get('reference', ''),
                    notes=serializer.validated_data.get('notes', ''),
                    requested_by=request.user if request.user.is_authenticated else None,
                    processed_by=request.user if request.user.is_authenticated else None,
                    processed_at=timezone.now(),
                    status='processed'  # Auto-process for now
                )
                
                return Response({
                    'success': True,
                    'refund_id': refund.id,
                    'amount': str(refund.amount),
                    'status': refund.status,
                    'invoice_balance': str(invoice.balance_due),
                    'message': f'Refund of ${refund.amount} processed successfully'
                }, status=status.HTTP_201_CREATED)
                
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def available_deposits(self, request, pk=None):
        """
        Get available deposits for this invoice's guest
        
        GET /api/invoices/{id}/available_deposits/
        """
        invoice = self.get_object()
        
        deposits = Deposit.objects.filter(
            guest=invoice.guest,
            status__in=['collected', 'partially_applied']
        ).order_by('-collected_at')
        
        # Filter deposits that have remaining amount > 0
        available_deposits = [d for d in deposits if d.remaining_amount > 0]
        
        serializer = DepositSerializer(available_deposits, many=True)
        
        return Response({
            'invoice_id': invoice.id,
            'guest_name': f"{invoice.guest.first_name} {invoice.guest.last_name}",
            'available_deposits_count': len(available_deposits),
            'total_available_amount': str(sum(d.remaining_amount for d in available_deposits)),
            'deposits': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def apply_deposit(self, request, pk=None):
        """
        Apply a deposit to this invoice
        
        POST /api/invoices/{id}/apply_deposit/
        Body: {
            "deposit_id": 123,
            "amount": "50.00"  // optional, defaults to full remaining amount
        }
        """
        invoice = self.get_object()
        
        serializer = ApplyDepositSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            deposit = Deposit.objects.get(id=serializer.validated_data['deposit_id'])
            amount = serializer.validated_data.get('amount')
            
            payment = deposit.apply_to_invoice(invoice, amount)
            invoice.refresh_from_db()
            
            return Response({
                'success': True,
                'payment_id': payment.id,
                'amount_applied': str(payment.amount),
                'deposit_remaining': str(deposit.remaining_amount),
                'invoice_balance': str(invoice.balance_due),
                'message': f'Deposit of ${payment.amount} applied successfully'
            }, status=status.HTTP_201_CREATED)
            
        except (Deposit.DoesNotExist, ValidationError) as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get invoice statistics"""
        queryset = self.get_queryset()
        
        # Basic counts
        total_invoices = queryset.count()
        paid_invoices = queryset.filter(status='paid').count()
        pending_invoices = queryset.filter(status__in=['issued', 'partial']).count()
        overdue_invoices = queryset.filter(status='overdue').count()
        
        # Financial totals
        total_revenue = queryset.filter(status='paid').aggregate(
            Sum('total')
        )['total__sum'] or Decimal('0.00')
        
        outstanding_balance = queryset.filter(
            status__in=['issued', 'partial', 'overdue']
        ).aggregate(Sum('balance_due'))['balance_due__sum'] or Decimal('0.00')
        
        # Average invoice amount
        avg_invoice_amount = queryset.aggregate(
            Avg('total')
        )['total__avg'] or Decimal('0.00')
        
        return Response({
            'total_invoices': total_invoices,
            'paid_invoices': paid_invoices,
            'pending_invoices': pending_invoices,
            'overdue_invoices': overdue_invoices,
            'total_revenue': str(total_revenue),
            'outstanding_balance': str(outstanding_balance),
            'average_invoice_amount': str(avg_invoice_amount),
        })


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for payment management (read-only)"""
    
    queryset = Payment.objects.all().select_related(
        'invoice', 'payment_method', 'deposit', 'processed_by'
    )
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['transaction_id', 'reference', 'notes']
    ordering_fields = ['payment_date', 'amount']
    ordering = ['-payment_date']


class RefundViewSet(viewsets.ModelViewSet):
    """ViewSet for refund management"""
    
    queryset = Refund.objects.all().select_related(
        'invoice', 'original_payment', 'requested_by', 'approved_by', 'processed_by'
    )
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reason', 'transaction_id', 'reference', 'notes']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a refund"""
        refund = self.get_object()
        
        if refund.status != 'pending':
            return Response(
                {'error': 'Only pending refunds can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        refund.approve(request.user)
        
        return Response({
            'success': True,
            'refund_id': refund.id,
            'status': refund.status,
            'approved_by': request.user.get_full_name() or request.user.username,
            'approved_at': refund.approved_at,
            'message': 'Refund approved successfully'
        })
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Process a refund"""
        refund = self.get_object()
        
        if refund.status not in ['pending', 'approved']:
            return Response(
                {'error': 'Only pending/approved refunds can be processed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transaction_id = request.data.get('transaction_id', '')
        reference = request.data.get('reference', '')
        
        refund.process(request.user, transaction_id, reference)
        
        return Response({
            'success': True,
            'refund_id': refund.id,
            'status': refund.status,
            'processed_by': request.user.get_full_name() or request.user.username,
            'processed_at': refund.processed_at,
            'message': 'Refund processed successfully'
        })


class DepositViewSet(viewsets.ModelViewSet):
    """ViewSet for deposit management"""
    
    queryset = Deposit.objects.all().select_related(
        'guest', 'reservation', 'collected_by'
    )
    serializer_class = DepositSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['guest__first_name', 'guest__last_name', 'transaction_id', 'reference']
    ordering_fields = ['collected_at', 'amount']
    ordering = ['-collected_at']
    
    def get_queryset(self):
        """Filter deposits by guest if specified"""
        queryset = super().get_queryset()
        
        guest_id = self.request.query_params.get('guest')
        if guest_id:
            queryset = queryset.filter(guest_id=guest_id)
        
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        return queryset


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for payment method management (read-only)"""
    
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
