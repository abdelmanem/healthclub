from rest_framework import serializers
from .models import Service, ServiceCategory
from reservations.models import Location


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "description"]


class ServiceSerializer(serializers.ModelSerializer):
    locations = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Location.objects.all(), required=False)
    category = ServiceCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=ServiceCategory.objects.all(), write_only=True, required=False, allow_null=True)

    class Meta:
        model = Service
        fields = ["id", "name", "description", "duration_minutes", "price", "category", "category_id", "locations"]

    

