from rest_framework import serializers
from .models import Location, Reservation, ReservationService


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["id", "name", "description"]


class ReservationServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationService
        fields = ["id", "service"]


class ReservationSerializer(serializers.ModelSerializer):
    reservation_services = ReservationServiceSerializer(many=True, required=False)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "location",
            "start_time",
            "end_time",
            "status",
            "notes",
            "reservation_services",
        ]

    def create(self, validated_data):
        services_data = validated_data.pop("reservation_services", [])
        reservation = Reservation.objects.create(**validated_data)
        for srv in services_data:
            ReservationService.objects.create(reservation=reservation, **srv)
        return reservation

    def update(self, instance, validated_data):
        services_data = validated_data.pop("reservation_services", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if services_data is not None:
            instance.reservation_services.all().delete()
            for srv in services_data:
                ReservationService.objects.create(reservation=instance, **srv)
        return instance

