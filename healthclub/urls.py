"""
URL configuration for healthclub project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from guests.views import GuestViewSet
from services.views import ServiceViewSet, ServiceCategoryViewSet
from reservations.views import LocationViewSet, ReservationViewSet, HousekeepingTaskViewSet
# from reservations.spa_scheduling_views import SpaSchedulingViewSet
from pos.views import InvoiceViewSet, PaymentViewSet
from employees.views import (
    EmployeeViewSet,
    EmployeeShiftViewSet,
    ReservationEmployeeAssignmentViewSet,
    EmployeeWeeklyScheduleViewSet,
    ShiftConfigurationViewSet,
)
from inventory.views import (
    SupplierViewSet, ProductCategoryViewSet, ProductViewSet,
    StockMovementViewSet, PurchaseOrderViewSet, ProductServiceLinkViewSet,
    InventoryAlertViewSet
)
from marketing.views import (
    EmailCampaignViewSet, SMSCampaignViewSet, EmailTemplateViewSet,
    SMSTemplateViewSet, CommunicationLogViewSet, GuestSegmentViewSet,
    MarketingAutomationViewSet
)
from analytics.views import (
    DashboardWidgetViewSet, ReportViewSet, ReportExecutionViewSet,
    KPIViewSet, KPIMeasurementViewSet, AlertViewSet, DashboardViewSet,
    DashboardWidgetPositionViewSet
)
from config.views import (
    SystemConfigurationViewSet, MembershipTierViewSet, GenderOptionViewSet,
    CommissionTypeViewSet, TrainingTypeViewSet, ProductTypeViewSet,
    BusinessRuleViewSet, NotificationTemplateViewSet, CancellationReasonViewSet
)
from accounts.views import get_current_user

router = DefaultRouter()
router.register(r'guests', GuestViewSet, basename='guest')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'service-categories', ServiceCategoryViewSet, basename='service-category')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'reservations', ReservationViewSet, basename='reservation')
# router.register(r'spa-scheduling', SpaSchedulingViewSet, basename='spa-scheduling')
router.register(r'housekeeping-tasks', HousekeepingTaskViewSet, basename='housekeeping-task')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'shifts', EmployeeShiftViewSet, basename='shift')
router.register(r'employee-weekly-schedules', EmployeeWeeklyScheduleViewSet, basename='employee-weekly-schedule')
router.register(r'shift-configurations', ShiftConfigurationViewSet)
router.register(r'reservation-assignments', ReservationEmployeeAssignmentViewSet, basename='reservation-assignment')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'product-categories', ProductCategoryViewSet, basename='product-category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'product-service-links', ProductServiceLinkViewSet, basename='product-service-link')
router.register(r'inventory-alerts', InventoryAlertViewSet, basename='inventory-alert')
router.register(r'email-campaigns', EmailCampaignViewSet, basename='email-campaign')
router.register(r'sms-campaigns', SMSCampaignViewSet, basename='sms-campaign')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'sms-templates', SMSTemplateViewSet, basename='sms-template')
router.register(r'communication-logs', CommunicationLogViewSet, basename='communication-log')
router.register(r'guest-segments', GuestSegmentViewSet, basename='guest-segment')
router.register(r'marketing-automation', MarketingAutomationViewSet, basename='marketing-automation')
router.register(r'dashboard-widgets', DashboardWidgetViewSet, basename='dashboard-widget')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'report-executions', ReportExecutionViewSet, basename='report-execution')
router.register(r'kpis', KPIViewSet, basename='kpi')
router.register(r'kpi-measurements', KPIMeasurementViewSet, basename='kpi-measurement')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'dashboards', DashboardViewSet, basename='dashboard')
router.register(r'dashboard-widget-positions', DashboardWidgetPositionViewSet, basename='dashboard-widget-position')
router.register(r'config/system-configurations', SystemConfigurationViewSet, basename='system-configuration')
router.register(r'config/membership-tiers', MembershipTierViewSet, basename='membership-tier')
router.register(r'config/gender-options', GenderOptionViewSet, basename='gender-option')
router.register(r'config/commission-types', CommissionTypeViewSet, basename='commission-type')
router.register(r'config/training-types', TrainingTypeViewSet, basename='training-type')
router.register(r'config/product-types', ProductTypeViewSet, basename='product-type')
router.register(r'config/business-rules', BusinessRuleViewSet, basename='business-rule')
router.register(r'config/notification-templates', NotificationTemplateViewSet, basename='notification-template')
router.register(r'config/cancellation-reasons', CancellationReasonViewSet, basename='cancellation-reason')




urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/user/', get_current_user, name='current_user'),
    path('api/health/', include('simple_history.urls')) if False else path('api/health/', SpectacularAPIView.as_view()),
]
