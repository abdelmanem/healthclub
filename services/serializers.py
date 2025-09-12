from rest_framework import serializers
from .models import Service
from reservations.models import Location


class ServiceSerializer(serializers.ModelSerializer):
    locations = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Location.objects.all())
    class Meta:
        model = Service
        fields = ["id", "name", "description", "duration_minutes", "price", "locations"]

    

