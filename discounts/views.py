from rest_framework import viewsets, status, decorators
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import DiscountType, ReservationDiscount, DiscountRule
from .serializers import (
    DiscountTypeSerializer, DiscountTypeListSerializer,
    ReservationDiscountSerializer, ReservationDiscountCreateSerializer,
    DiscountRuleSerializer, DiscountApplicationSerializer
)
from healthclub.permissions import ObjectPermissionsOrReadOnly


class DiscountTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing discount types"""
    
    queryset = DiscountType.objects.all()
    serializer_class = DiscountTypeSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'created_at', 'priority']
    filterset_fields = {
        'is_active': ['exact'],
        'requires_approval': ['exact'],
        'discount_method': ['exact'],
        'created_at': ['gte', 'lte'],
    }
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DiscountTypeListSerializer
        return DiscountTypeSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.is_staff or user.is_superuser:
            return qs
        
        # Filter by permissions
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'discounts.view_discounttype', qs)
    
    @decorators.action(detail=True, methods=['get'], url_path='usage-stats')
    def usage_stats(self, request, pk=None):
        """Get usage statistics for a discount type"""
        discount_type = self.get_object()
        
        # Get usage statistics
        total_usage = ReservationDiscount.objects.filter(
            discount_type=discount_type,
            status__in=['applied', 'approved']
        ).count()
        
        total_discount_amount = ReservationDiscount.objects.filter(
            discount_type=discount_type,
            status__in=['applied', 'approved']
        ).aggregate(total=models.Sum('discount_amount'))['total'] or 0
        
        # Recent usage (last 30 days)
        from django.utils import timezone
        from datetime import timedelta
        
        recent_usage = ReservationDiscount.objects.filter(
            discount_type=discount_type,
            status__in=['applied', 'approved'],
            applied_at__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        return Response({
            'total_usage': total_usage,
            'total_discount_amount': total_discount_amount,
            'recent_usage': recent_usage,
        })


class ReservationDiscountViewSet(viewsets.ModelViewSet):
    """ViewSet for managing reservation discounts"""
    
    queryset = ReservationDiscount.objects.all()
    serializer_class = ReservationDiscountSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'reservation__guest__first_name',
        'reservation__guest__last_name',
        'discount_type__name',
        'reason'
    ]
    ordering_fields = ['applied_at', 'discount_amount']
    filterset_fields = {
        'status': ['exact'],
        'discount_type': ['exact'],
        'reservation': ['exact'],
        'applied_by': ['exact'],
        'approved_by': ['exact'],
        'applied_at': ['gte', 'lte'],
    }
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ReservationDiscountCreateSerializer
        return ReservationDiscountSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.is_staff or user.is_superuser:
            return qs
        
        # Filter by permissions
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'discounts.view_reservationdiscount', qs)
    
    @decorators.action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Approve a pending discount"""
        discount = self.get_object()
        
        if discount.status != 'pending':
            return Response(
                {'error': 'Only pending discounts can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        notes = request.data.get('notes', '')
        discount.approve(request.user, notes)
        
        serializer = self.get_serializer(discount)
        return Response(serializer.data)
    
    @decorators.action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Reject a pending discount"""
        discount = self.get_object()
        
        if discount.status != 'pending':
            return Response(
                {'error': 'Only pending discounts can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', '')
        discount.reject(request.user, reason)
        
        serializer = self.get_serializer(discount)
        return Response(serializer.data)
    
    @decorators.action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Cancel an applied discount"""
        discount = self.get_object()
        
        if discount.status not in ['applied', 'approved']:
            return Response(
                {'error': 'Only applied or approved discounts can be cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', '')
        discount.cancel(request.user, reason)
        
        serializer = self.get_serializer(discount)
        return Response(serializer.data)


class DiscountRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing discount rules"""
    
    queryset = DiscountRule.objects.all()
    serializer_class = DiscountRuleSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['priority', 'name', 'created_at']
    filterset_fields = {
        'is_active': ['exact'],
        'priority': ['exact', 'gte', 'lte'],
        'created_at': ['gte', 'lte'],
    }
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.is_staff or user.is_superuser:
            return qs
        
        # Filter by permissions
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'discounts.view_discountrule', qs)


class DiscountApplicationViewSet(viewsets.ViewSet):
    """ViewSet for applying discounts to reservations"""
    
    permission_classes = [IsAuthenticated]
    
    @decorators.action(detail=False, methods=['post'], url_path='apply')
    def apply_discount(self, request):
        """Apply a discount to a reservation"""
        serializer = DiscountApplicationSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                # Get reservation and discount type
                from reservations.models import Reservation
                reservation = get_object_or_404(Reservation, id=data['reservation_id'])
                discount_type = get_object_or_404(DiscountType, id=data['discount_type_id'])
                
                # Check if discount can be applied
                if not self.can_apply_discount(reservation, discount_type, request.user):
                    return Response(
                        {'error': 'Discount cannot be applied to this reservation'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Calculate amounts
                original_amount = self.calculate_reservation_total(reservation)
                discount_amount = self.calculate_discount_amount(original_amount, discount_type)
                
                # Create discount record
                discount = ReservationDiscount.objects.create(
                    reservation=reservation,
                    discount_type=discount_type,
                    applied_by=request.user,
                    original_amount=original_amount,
                    discount_amount=discount_amount,
                    final_amount=original_amount - discount_amount,
                    reason=data.get('reason', ''),
                    notes=data.get('notes', ''),
                    status='pending' if discount_type.requires_approval else 'applied'
                )
                
                serializer = ReservationDiscountSerializer(discount)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def can_apply_discount(self, reservation, discount_type, user):
        """Check if discount can be applied"""
        # Check if discount type is valid
        if not discount_type.is_valid_now():
            return False
        
        # Check if guest is eligible
        if not discount_type.can_be_used_by_guest(reservation.guest):
            return False
        
        # Check if discount can be used today
        if not discount_type.can_be_used_today():
            return False
        
        # Check if discount already applied to this reservation
        if ReservationDiscount.objects.filter(
            reservation=reservation,
            discount_type=discount_type
        ).exists():
            return False
        
        # Check user permissions
        if not user.has_perm('discounts.apply_discount'):
            return False
        
        return True
    
    def calculate_reservation_total(self, reservation):
        """Calculate total amount for reservation"""
        total = 0
        for service in reservation.reservation_services.all():
            total += service.total_price
        return total
    
    def calculate_discount_amount(self, original_amount, discount_type):
        """Calculate discount amount based on type"""
        if discount_type.discount_method == 'percentage':
            discount_amount = original_amount * (discount_type.discount_value / 100)
        elif discount_type.discount_method == 'fixed_amount':
            discount_amount = discount_type.discount_value
        else:  # free_service
            discount_amount = original_amount
        
        # Apply maximum discount limit
        if discount_type.max_discount_amount:
            discount_amount = min(discount_amount, discount_type.max_discount_amount)
        
        return discount_amount
