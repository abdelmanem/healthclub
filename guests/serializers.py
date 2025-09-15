from rest_framework import serializers
from config.models import MembershipTier
from .models import (
    Guest, GuestAddress, EmergencyContact, GuestPreference, 
    GuestCommunication
)


class GuestAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestAddress
        fields = [
            "id",
            "address_type",
            "street_address",
            "city",
            "state",
            "postal_code",
            "country",
            "is_primary",
        ]


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ["id", "name", "relationship", "phone", "email", "is_primary"]


class GuestPreferenceSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    
    class Meta:
        model = GuestPreference
        fields = ["id", "service", "service_name", "rating", "notes", "created_at", "updated_at"]


class GuestCommunicationSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    
    class Meta:
        model = GuestCommunication
        fields = [
            "id", "communication_type", "subject", "message", 
            "sent_at", "sent_by", "sent_by_name", "is_successful", 
            "response_received"
        ]


class GuestSerializer(serializers.ModelSerializer):
    addresses = GuestAddressSerializer(many=True, required=False)
    emergency_contacts = EmergencyContactSerializer(many=True, required=False)
    preferences = GuestPreferenceSerializer(many=True, required=False, read_only=True)
    communications = GuestCommunicationSerializer(many=True, required=False, read_only=True)
    full_name = serializers.CharField(read_only=True)
    membership_benefits = serializers.SerializerMethodField()

    class Meta:
        model = Guest
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "gender",
            "date_of_birth",
            "email",
            "phone",
            "medical_notes",
            "membership_id",
            "membership_tier",
            "loyalty_points",
            "total_spent",
            "visit_count",
            "last_visit",
            "email_notifications",
            "sms_notifications",
            "marketing_emails",
            "preferred_services",
            "allergies",
            "special_requirements",
            "house_status",
            "addresses",
            "emergency_contacts",
            "preferences",
            "communications",
            "membership_benefits",
        ]

    # Represent membership_tier by its unique "name" slug from config.MembershipTier
    membership_tier = serializers.SlugRelatedField(
        slug_field='name',
        queryset=MembershipTier.objects.filter(is_active=True),
        allow_null=True,
        required=False
    )

    def get_membership_benefits(self, obj):
        return obj.get_membership_benefits()

    def create(self, validated_data):
        addresses_data = validated_data.pop("addresses", [])
        contacts_data = validated_data.pop("emergency_contacts", [])
        guest = Guest.objects.create(**validated_data)
        for addr in addresses_data:
            GuestAddress.objects.create(guest=guest, **addr)
        for ec in contacts_data:
            EmergencyContact.objects.create(guest=guest, **ec)
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
                EmergencyContact.objects.create(guest=instance, **ec)

        return instance

