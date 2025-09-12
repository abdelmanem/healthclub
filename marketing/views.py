from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    EmailCampaign, SMSCampaign, EmailTemplate, SMSTemplate,
    CommunicationLog, GuestSegment, MarketingAutomation
)
from .serializers import (
    EmailCampaignSerializer, SMSCampaignSerializer, EmailTemplateSerializer,
    SMSTemplateSerializer, CommunicationLogSerializer, GuestSegmentSerializer,
    MarketingAutomationSerializer
)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['template_type', 'is_active']
    search_fields = ['name', 'subject', 'content']
    ordering_fields = ['name', 'created_at']
    ordering = ['template_type', 'name']


class SMSTemplateViewSet(viewsets.ModelViewSet):
    queryset = SMSTemplate.objects.all()
    serializer_class = SMSTemplateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['template_type', 'is_active']
    search_fields = ['name', 'message']
    ordering_fields = ['name', 'created_at']
    ordering = ['template_type', 'name']


class GuestSegmentViewSet(viewsets.ModelViewSet):
    queryset = GuestSegment.objects.all()
    serializer_class = GuestSegmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['get'])
    def guests(self, request, pk=None):
        """Get guests in this segment"""
        segment = self.get_object()
        guests = segment.get_guests()
        
        # Apply pagination
        page = self.paginate_queryset(guests)
        if page is not None:
            from guests.serializers import GuestSerializer
            serializer = GuestSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        from guests.serializers import GuestSerializer
        serializer = GuestSerializer(guests, many=True)
        return Response(serializer.data)


class EmailCampaignViewSet(viewsets.ModelViewSet):
    queryset = EmailCampaign.objects.all()
    serializer_class = EmailCampaignSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['campaign_type', 'status', 'created_by']
    search_fields = ['name', 'subject', 'content']
    ordering_fields = ['name', 'created_at', 'sent_at']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send the email campaign"""
        campaign = self.get_object()
        if campaign.status != 'draft':
            return Response(
                {'error': 'Campaign can only be sent from draft status'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status to sending
        campaign.status = 'sending'
        campaign.save()
        
        # TODO: Implement actual email sending logic
        # This would integrate with email service providers like SendGrid, Mailgun, etc.
        
        return Response({'message': 'Campaign sending initiated'})
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get campaign statistics"""
        campaign = self.get_object()
        stats = {
            'total_recipients': campaign.total_recipients,
            'delivered_count': campaign.delivered_count,
            'opened_count': campaign.opened_count,
            'clicked_count': campaign.clicked_count,
            'unsubscribed_count': campaign.unsubscribed_count,
            'bounced_count': campaign.bounced_count,
            'open_rate': campaign.open_rate,
            'click_rate': campaign.click_rate,
        }
        return Response(stats)


class SMSCampaignViewSet(viewsets.ModelViewSet):
    queryset = SMSCampaign.objects.all()
    serializer_class = SMSCampaignSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['campaign_type', 'status', 'created_by']
    search_fields = ['name', 'message']
    ordering_fields = ['name', 'created_at', 'sent_at']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send the SMS campaign"""
        campaign = self.get_object()
        if campaign.status != 'draft':
            return Response(
                {'error': 'Campaign can only be sent from draft status'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status to sending
        campaign.status = 'sending'
        campaign.save()
        
        # TODO: Implement actual SMS sending logic
        # This would integrate with SMS service providers like Twilio, AWS SNS, etc.
        
        return Response({'message': 'SMS campaign sending initiated'})
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get campaign statistics"""
        campaign = self.get_object()
        stats = {
            'total_recipients': campaign.total_recipients,
            'delivered_count': campaign.delivered_count,
            'failed_count': campaign.failed_count,
            'delivery_rate': (campaign.delivered_count / campaign.total_recipients * 100) if campaign.total_recipients > 0 else 0,
        }
        return Response(stats)


class CommunicationLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CommunicationLog.objects.all()
    serializer_class = CommunicationLogSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['communication_type', 'status', 'guest']
    search_fields = ['guest__first_name', 'guest__last_name', 'subject', 'message']
    ordering_fields = ['created_at', 'sent_at']
    ordering = ['-created_at']


class MarketingAutomationViewSet(viewsets.ModelViewSet):
    queryset = MarketingAutomation.objects.all()
    serializer_class = MarketingAutomationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['trigger_type', 'action_type', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test the automation rule"""
        automation = self.get_object()
        # TODO: Implement automation testing logic
        return Response({'message': 'Automation test initiated'})
