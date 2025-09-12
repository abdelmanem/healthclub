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
from guests.views import GuestViewSet
from services.views import ServiceViewSet
from reservations.views import LocationViewSet, ReservationViewSet
from pos.views import InvoiceViewSet, PaymentViewSet
from employees.views import (
    EmployeeViewSet,
    EmployeeShiftViewSet,
    ReservationEmployeeAssignmentViewSet,
)

router = DefaultRouter()
router.register(r'guests', GuestViewSet, basename='guest')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'reservations', ReservationViewSet, basename='reservation')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'shifts', EmployeeShiftViewSet, basename='shift')
router.register(r'reservation-assignments', ReservationEmployeeAssignmentViewSet, basename='reservation-assignment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
