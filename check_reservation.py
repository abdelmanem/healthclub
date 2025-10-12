#!/usr/bin/env python
import os
import sys
import django

# Add the project directory to Python path
sys.path.append('C:/trae/healthclub')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'healthclub.settings')
django.setup()

from reservations.models import Reservation
from pos.models import Invoice
from decimal import Decimal

# Check reservation 40
try:
    res = Reservation.objects.get(id=40)
    print('Reservation 40:')
    print(f'  Status: {res.status}')
    print(f'  Guest: {res.guest}')
    # Calculate total from services
    total_price = Decimal('0.00')
    if hasattr(res, 'reservation_services'):
        for rs in res.reservation_services.all():
            if hasattr(rs, 'total_price'):
                total_price += rs.total_price  # Property, not method
            elif hasattr(rs, 'unit_price') and hasattr(rs, 'quantity'):
                total_price += (rs.unit_price or Decimal('0.00')) * (rs.quantity or 1)
    print(f'  Calculated Total Price: {total_price}')
    print(f'  Has services: {hasattr(res, "reservation_services")}')
    
    if hasattr(res, 'reservation_services'):
        print(f'  Services count: {res.reservation_services.count()}')
        for rs in res.reservation_services.all():
            print(f'    Service: {rs.service}, Price: {rs.unit_price}, Qty: {rs.quantity}')
            if hasattr(rs, 'total_price'):
                print(f'      Total: {rs.total_price}')

    # Check if invoice already exists
    existing_invoice = Invoice.objects.filter(reservation=res).first()
    print(f'\nExisting invoice: {existing_invoice}')
    if existing_invoice:
        print(f'  Invoice ID: {existing_invoice.id}')
        print(f'  Invoice Number: {existing_invoice.invoice_number}')
    else:
        print('  No existing invoice found')
        
except Exception as e:
    print(f'Error: {e}')
