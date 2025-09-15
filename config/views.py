from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.permissions import SAFE_METHODS

from .models import (
    SystemConfiguration, MembershipTier, GenderOption, 
    CommissionType, TrainingType, ProductType, BusinessRule, NotificationTemplate
)
from healthclub.permissions import ObjectPermissionsOrReadOnly


class SystemConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfiguration
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class MembershipTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipTier
        fields = '__all__'


class GenderOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenderOption
        fields = '__all__'


class CommissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionType
        fields = '__all__'


class TrainingTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingType
        fields = '__all__'


class ProductTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductType
        fields = '__all__'


class BusinessRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessRule
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class SystemConfigurationViewSet(viewsets.ModelViewSet):
    queryset = SystemConfiguration.objects.all().order_by('key')
    serializer_class = SystemConfigurationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['key', 'description']
    ordering_fields = ['key', 'created_at', 'updated_at']
    filterset_fields = ['data_type', 'is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_systemconfiguration', qs)

    @action(detail=False, methods=['get'], url_path='get-value/(?P<key>[^/.]+)')
    def get_value(self, request, key=None):
        """Get a specific configuration value"""
        try:
            config = SystemConfiguration.objects.get(key=key, is_active=True)
            return Response({
                'key': config.key,
                'value': config.value,
                'data_type': config.data_type,
                'description': config.description
            })
        except SystemConfiguration.DoesNotExist:
            return Response(
                {'error': f'Configuration key "{key}" not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='set-value')
    def set_value(self, request):
        """Set a configuration value"""
        key = request.data.get('key')
        value = request.data.get('value')
        data_type = request.data.get('data_type', 'string')
        description = request.data.get('description', '')

        if not key or value is None:
            return Response(
                {'error': 'Key and value are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        config, created = SystemConfiguration.objects.get_or_create(
            key=key,
            defaults={
                'value': str(value),
                'data_type': data_type,
                'description': description,
                'is_active': True
            }
        )

        if not created:
            config.value = str(value)
            config.data_type = data_type
            config.description = description
            config.save()

        serializer = self.get_serializer(config)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MembershipTierViewSet(viewsets.ModelViewSet):
    queryset = MembershipTier.objects.all().order_by('sort_order', 'name')
    serializer_class = MembershipTierSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'display_name', 'description']
    ordering_fields = ['name', 'sort_order', 'discount_percentage']
    filterset_fields = ['is_active', 'priority_booking']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Allow any authenticated user to read active tiers without object-level perms
        if self.request.method in SAFE_METHODS:
            return qs.filter(is_active=True)
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_membershiptier', qs)


class GenderOptionViewSet(viewsets.ModelViewSet):
    queryset = GenderOption.objects.all().order_by('sort_order', 'code')
    serializer_class = GenderOptionSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'display_name', 'description']
    ordering_fields = ['code', 'sort_order']
    filterset_fields = ['is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_genderoption', qs)


class CommissionTypeViewSet(viewsets.ModelViewSet):
    queryset = CommissionType.objects.all().order_by('sort_order', 'name')
    serializer_class = CommissionTypeSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['name', 'sort_order', 'percentage']
    filterset_fields = ['is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_commissiontype', qs)


class TrainingTypeViewSet(viewsets.ModelViewSet):
    queryset = TrainingType.objects.all().order_by('sort_order', 'name')
    serializer_class = TrainingTypeSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['name', 'sort_order']
    filterset_fields = ['is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_trainingtype', qs)


class ProductTypeViewSet(viewsets.ModelViewSet):
    queryset = ProductType.objects.all().order_by('sort_order', 'name')
    serializer_class = ProductTypeSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['name', 'sort_order', 'default_tax_rate']
    filterset_fields = ['is_active', 'requires_tracking']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_producttype', qs)


class BusinessRuleViewSet(viewsets.ModelViewSet):
    queryset = BusinessRule.objects.all().order_by('category', 'name')
    serializer_class = BusinessRuleSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'key']
    ordering_fields = ['category', 'name', 'created_at']
    filterset_fields = ['category', 'is_active', 'data_type']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_businessrule', qs)

    @action(detail=False, methods=['get'], url_path='get-rule/(?P<key>[^/.]+)')
    def get_rule(self, request, key=None):
        """Get a specific business rule value"""
        try:
            rule = BusinessRule.objects.get(key=key, is_active=True)
            return Response({
                'key': rule.key,
                'value': rule.value,
                'data_type': rule.data_type,
                'category': rule.category,
                'description': rule.description
            })
        except BusinessRule.DoesNotExist:
            return Response(
                {'error': f'Business rule "{key}" not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='set-rule')
    def set_rule(self, request):
        """Set a business rule value"""
        key = request.data.get('key')
        value = request.data.get('value')
        category = request.data.get('category', 'booking')
        data_type = request.data.get('data_type', 'string')
        description = request.data.get('description', '')

        if not key or value is None:
            return Response(
                {'error': 'Key and value are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        rule, created = BusinessRule.objects.get_or_create(
            key=key,
            defaults={
                'value': str(value),
                'category': category,
                'data_type': data_type,
                'description': description,
                'is_active': True
            }
        )

        if not created:
            rule.value = str(value)
            rule.category = category
            rule.data_type = data_type
            rule.description = description
            rule.save()

        serializer = self.get_serializer(rule)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    queryset = NotificationTemplate.objects.all().order_by('name')
    serializer_class = NotificationTemplateSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'template_type']
    ordering_fields = ['name', 'template_type', 'created_at']
    filterset_fields = ['template_type', 'is_active']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'config.view_notificationtemplate', qs)
