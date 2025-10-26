from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DiscountTypeViewSet, ReservationDiscountViewSet, 
    DiscountRuleViewSet, DiscountApplicationViewSet
)

router = DefaultRouter()
router.register(r'discount-types', DiscountTypeViewSet)
router.register(r'reservation-discounts', ReservationDiscountViewSet)
router.register(r'discount-rules', DiscountRuleViewSet)
router.register(r'discount-application', DiscountApplicationViewSet, basename='discount-application')

urlpatterns = [
    path('', include(router.urls)),
]
