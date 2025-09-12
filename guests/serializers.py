from rest_framework import serializers
from .models import Guest, GuestAddress, GuestEmergencyContact


class GuestAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestAddress
        fields = [
            "id",
            "street",
            "city",
            "country",
            "zip_code",
        ]


class GuestEmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestEmergencyContact
        fields = ["id", "name", "phone", "relation"]


class GuestSerializer(serializers.ModelSerializer):
    addresses = GuestAddressSerializer(many=True, required=False)
    emergency_contacts = GuestEmergencyContactSerializer(many=True, required=False)

    class Meta:
        model = Guest
        fields = [
            "id",
            "first_name",
            "last_name",
            "gender",
            "date_of_birth",
            "email",
            "phone",
            "medical_notes",
            "membership_id",
            "house_status",
            "addresses",
            "emergency_contacts",
        ]

    def create(self, validated_data):
        addresses_data = validated_data.pop("addresses", [])
        contacts_data = validated_data.pop("emergency_contacts", [])
        guest = Guest.objects.create(**validated_data)
        for addr in addresses_data:
            GuestAddress.objects.create(guest=guest, **addr)
        for ec in contacts_data:
            GuestEmergencyContact.objects.create(guest=guest, **ec)
        return guest

    def update(self, instance, validated_data):
        addresses_data = validated_data.pop("addresses", None)
        contacts_data = validated_data.pop("emergency_contacts", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if addresses_data is not None:
            instance.addresses.all().delete()
            for addr in addresses_data:
                GuestAddress.objects.create(guest=instance, **addr)

        if contacts_data is not None:
            instance.emergency_contacts.all().delete()
            for ec in contacts_data:
                GuestEmergencyContact.objects.create(guest=instance, **ec)

        return instance

