#!/usr/bin/env python
"""
Script to check existing reservations and find available time slots
"""
import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'healthclub.settings')
django.setup()

from reservations.models import Reservation
from reservations.models import Location
from services.models import Service

def check_reservations_for_location(location_id, start_date=None, end_date=None):
    """Check existing reservations for a specific location"""
    if not start_date:
        start_date = timezone.now()
    if not end_date:
        end_date = start_date + timedelta(days=7)
    
    reservations = Reservation.objects.filter(
        location_id=location_id,
        start_time__gte=start_date,
        start_time__lte=end_date,
        status__in=['booked', 'checked_in', 'in_service']
    ).order_by('start_time')
    
    print(f"\n📅 Reservations for Location ID {location_id} from {start_date.strftime('%Y-%m-%d %H:%M')} to {end_date.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 80)
    
    if not reservations.exists():
        print("✅ No existing reservations found!")
        return []
    
    for res in reservations:
        print(f"🕐 {res.start_time.strftime('%Y-%m-%d %H:%M')} - {res.end_time.strftime('%H:%M')}")
        print(f"   Guest: {res.guest.first_name} {res.guest.last_name}")
        print(f"   Status: {res.status}")
        print(f"   Services: {', '.join([rs.service.name for rs in res.reservation_services.all()])}")
        print()
    
    return list(reservations)

def find_available_slots(location_id, service_id, date, duration_minutes=90):
    """Find available time slots for a specific service and location"""
    try:
        service = Service.objects.get(id=service_id)
        location = Location.objects.get(id=location_id)
    except (Service.DoesNotExist, Location.DoesNotExist) as e:
        print(f"❌ Error: {e}")
        return []
    
    print(f"\n🔍 Finding available slots for:")
    print(f"   Service: {service.name} ({service.duration_minutes} min)")
    print(f"   Location: {location.name}")
    print(f"   Date: {date.strftime('%Y-%m-%d')}")
    print(f"   Duration: {duration_minutes} minutes")
    print("=" * 80)
    
    # Define working hours (9 AM to 9 PM)
    start_hour = 9
    end_hour = 21
    
    # Get existing reservations for the day
    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    existing_reservations = Reservation.objects.filter(
        location_id=location_id,
        start_time__gte=day_start,
        start_time__lt=day_end,
        status__in=['booked', 'checked_in', 'in_service']
    ).order_by('start_time')
    
    # Convert to time ranges
    occupied_ranges = []
    for res in existing_reservations:
        occupied_ranges.append((res.start_time, res.end_time))
    
    # Find available slots
    available_slots = []
    current_time = date.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    end_time = date.replace(hour=end_hour, minute=0, second=0, microsecond=0)
    
    while current_time + timedelta(minutes=duration_minutes) <= end_time:
        slot_end = current_time + timedelta(minutes=duration_minutes)
        
        # Check if this slot conflicts with any existing reservation
        conflicts = False
        for occupied_start, occupied_end in occupied_ranges:
            if (current_time < occupied_end and slot_end > occupied_start):
                conflicts = True
                break
        
        if not conflicts:
            available_slots.append((current_time, slot_end))
        
        # Move to next 30-minute slot
        current_time += timedelta(minutes=30)
    
    if available_slots:
        print(f"✅ Found {len(available_slots)} available slots:")
        for i, (start, end) in enumerate(available_slots[:10], 1):  # Show first 10
            print(f"   {i:2d}. {start.strftime('%H:%M')} - {end.strftime('%H:%M')}")
        if len(available_slots) > 10:
            print(f"   ... and {len(available_slots) - 10} more slots")
    else:
        print("❌ No available slots found for this day")
    
    return available_slots

def main():
    print("🏥 Health Club Reservation Checker")
    print("=" * 50)
    
    # Get all locations
    locations = Location.objects.all()
    print(f"\n📍 Available Locations:")
    for loc in locations:
        print(f"   ID {loc.id}: {loc.name}")
    
    # Get all services
    services = Service.objects.all()
    print(f"\n🛠️  Available Services:")
    for svc in services:
        print(f"   ID {svc.id}: {svc.name} ({svc.duration_minutes} min)")
    
    # Example: Check reservations for Room 1 (ID 1) today
    location_id = 1  # Room 1
    service_id = 6   # Deep Tissue Massage
    today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    print(f"\n" + "="*80)
    print("EXAMPLE CHECK:")
    
    # Check existing reservations
    check_reservations_for_location(location_id, today, today + timedelta(days=1))
    
    # Find available slots
    find_available_slots(location_id, service_id, today)

if __name__ == "__main__":
    main()
