from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'system-configurations', views.SystemConfigurationViewSet)
router.register(r'membership-tiers', views.MembershipTierViewSet)
router.register(r'gender-options', views.GenderOptionViewSet)
router.register(r'commission-types', views.CommissionTypeViewSet)
router.register(r'training-types', views.TrainingTypeViewSet)
router.register(r'product-types', views.ProductTypeViewSet)
router.register(r'business-rules', views.BusinessRuleViewSet)
router.register(r'notification-templates', views.NotificationTemplateViewSet)
router.register(r'cancellation-reasons', views.CancellationReasonViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
