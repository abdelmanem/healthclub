from rest_framework import serializers
from .models import (
    EmailCampaign, SMSCampaign, EmailTemplate, SMSTemplate,
    CommunicationLog, GuestSegment, MarketingAutomation
)


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'


class SMSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSTemplate
        fields = '__all__'


class GuestSegmentSerializer(serializers.ModelSerializer):
    guest_count = serializers.SerializerMethodField()
    
    class Meta:
        model = GuestSegment
        fields = '__all__'
    
    def get_guest_count(self, obj):
        return obj.get_guests().count()


class EmailCampaignSerializer(serializers.ModelSerializer):
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = EmailCampaign
        fields = '__all__'
        read_only_fields = ('total_recipients', 'delivered_count', 'opened_count', 'clicked_count', 'unsubscribed_count', 'bounced_count', 'sent_at')


class SMSCampaignSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = SMSCampaign
        fields = '__all__'
        read_only_fields = ('total_recipients', 'delivered_count', 'failed_count', 'sent_at')


class CommunicationLogSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source='guest.get_full_name', read_only=True)
    
    class Meta:
        model = CommunicationLog
        fields = '__all__'


class MarketingAutomationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingAutomation
        fields = '__all__'
