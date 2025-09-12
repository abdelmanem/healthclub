from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum, F
from django.utils import timezone
from datetime import timedelta

from .models import (
    Supplier, ProductCategory, Product, StockMovement, 
    PurchaseOrder, PurchaseOrderItem, ProductServiceLink, InventoryAlert
)
from .serializers import (
    SupplierSerializer, ProductCategorySerializer, ProductSerializer,
    StockMovementSerializer, PurchaseOrderSerializer, PurchaseOrderItemSerializer,
    ProductServiceLinkSerializer, InventoryAlertSerializer
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'contact_person', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'parent_category']
    search_fields = ['name', 'description']
    ordering_fields = ['name']
    ordering = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['product_type', 'category', 'is_active', 'is_taxable']
    search_fields = ['name', 'sku', 'barcode', 'description']
    ordering_fields = ['name', 'current_stock', 'selling_price', 'created_at']
    ordering = ['name']
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get products with low stock"""
        products = self.get_queryset().filter(
            current_stock__lte=F('min_stock_level')
        )
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def out_of_stock(self, request):
        """Get products that are out of stock"""
        products = self.get_queryset().filter(current_stock=0)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        """Adjust stock for a product"""
        product = self.get_object()
        quantity = request.data.get('quantity', 0)
        notes = request.data.get('notes', '')
        
        try:
            if quantity > 0:
                product.add_stock(quantity, notes)
            else:
                product.remove_stock(abs(quantity), notes)
            
            return Response({'message': 'Stock adjusted successfully'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def inventory_summary(self, request):
        """Get inventory summary statistics"""
        total_products = Product.objects.count()
        low_stock_count = Product.objects.filter(
            current_stock__lte=F('min_stock_level')
        ).count()
        out_of_stock_count = Product.objects.filter(current_stock=0).count()
        total_stock_value = Product.objects.aggregate(
            total=Sum(F('current_stock') * F('cost_price'))
        )['total'] or 0
        
        return Response({
            'total_products': total_products,
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'total_stock_value': total_stock_value
        })


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.all()
    serializer_class = StockMovementSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['movement_type', 'product', 'created_by']
    search_fields = ['product__name', 'reference', 'notes']
    ordering_fields = ['created_at', 'quantity']
    ordering = ['-created_at']


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'supplier', 'created_by']
    search_fields = ['po_number', 'supplier__name']
    ordering_fields = ['order_date', 'total_amount', 'created_at']
    ordering = ['-order_date']
    
    @action(detail=True, methods=['post'])
    def receive_items(self, request, pk=None):
        """Receive items for a purchase order"""
        purchase_order = self.get_object()
        items_data = request.data.get('items', [])
        
        for item_data in items_data:
            item_id = item_data.get('id')
            quantity_received = item_data.get('quantity_received', 0)
            
            try:
                item = PurchaseOrderItem.objects.get(id=item_id, purchase_order=purchase_order)
                item.quantity_received += quantity_received
                item.save()
                
                # Update product stock
                if quantity_received > 0:
                    item.product.add_stock(quantity_received, f"Received from PO {purchase_order.po_number}")
                
            except PurchaseOrderItem.DoesNotExist:
                continue
        
        # Update purchase order status
        total_ordered = sum(item.quantity_ordered for item in purchase_order.items.all())
        total_received = sum(item.quantity_received for item in purchase_order.items.all())
        
        if total_received >= total_ordered:
            purchase_order.status = 'received'
            purchase_order.actual_delivery = timezone.now().date()
            purchase_order.save()
        
        return Response({'message': 'Items received successfully'})


class ProductServiceLinkViewSet(viewsets.ModelViewSet):
    queryset = ProductServiceLink.objects.all()
    serializer_class = ProductServiceLinkSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['service', 'product', 'is_optional']
    search_fields = ['service__name', 'product__name', 'notes']
    ordering_fields = ['service__name', 'product__name']
    ordering = ['service__name', 'product__name']


class InventoryAlertViewSet(viewsets.ModelViewSet):
    queryset = InventoryAlert.objects.all()
    serializer_class = InventoryAlertSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['alert_type', 'is_resolved', 'product']
    search_fields = ['product__name', 'message']
    ordering_fields = ['created_at', 'alert_type']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve an inventory alert"""
        alert = self.get_object()
        alert.is_resolved = True
        alert.resolved_by = request.user
        alert.resolved_at = timezone.now()
        alert.save()
        
        return Response({'message': 'Alert resolved successfully'})
    
    @action(detail=False, methods=['get'])
    def unresolved(self, request):
        """Get unresolved alerts"""
        alerts = self.get_queryset().filter(is_resolved=False)
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)
