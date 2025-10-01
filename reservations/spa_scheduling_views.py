from rest_framework import viewsets, decorators, response, status
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from django.utils import timezone
from datetime import datetime, timedelta, time
import pytz
from .models import Reservation, Location
from .serializers import ReservationSerializer
from employees.models import Employee
from employees.serializers import EmployeeSerializer
from healthclub.permissions import ObjectPermissionsOrReadOnly

# Set your spa's timezone (example: Cairo, Egypt)
SPA_TIMEZONE = pytz.timezone("Africa/Cairo")


class SpaSchedulingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for spa scheduling functionality
    Provides endpoints for the spa scheduling interface
    """
    queryset = Reservation.objects.all().select_related(
        "guest", 
        "location",
        "employee"
    ).prefetch_related(
        "reservation_services__service__category",
        "employee_assignments__employee__user"
    ).order_by("start_time")
    
    serializer_class = ReservationSerializer
    permission_classes = [ObjectPermissionsOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'start_time': ['gte', 'lte', 'date'],
        'status': ['exact', 'in'],
        'employee': ['exact', 'in'],
        'location': ['exact', 'in'],
    }

    @action(detail=False, methods=['get'], url_path='scheduling-data/(?P<date>[^/.]+)')
    def get_scheduling_data(self, request, date=None):
        """
        Get all scheduling data for a specific date
        Returns appointments, staff, and other relevant data
        """
        try:
            # Parse the date
            target_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            return response.Response(
                {"error": "Invalid date format. Use YYYY-MM-DD"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get start and end of the day (6:00 AM to 1:00 AM next day) in spa timezone
        start_datetime = SPA_TIMEZONE.localize(datetime.combine(target_date, time(hour=6)))
        end_datetime = SPA_TIMEZONE.localize(datetime.combine(target_date + timedelta(days=1), time(hour=1)))

        # Get all reservations for the date (including overnight appointments)
        reservations = self.get_queryset().filter(
            start_time__gte=start_datetime,
            start_time__lt=end_datetime
        ).order_by('start_time')

        # Get all active employees (staff)
        staff = Employee.objects.filter(
            active=True
        ).select_related('user').prefetch_related('services')

        # Convert reservations to spa appointment format
        appointments = []
        for reservation in reservations:
            # Get primary employee assignment
            primary_assignment = reservation.employee_assignments.first()
            employee_id = str(primary_assignment.employee.id) if primary_assignment else None
            
            # Determine appointment color based on status
            color = 'grey'  # default
            if reservation.status == Reservation.STATUS_BOOKED:
                color = 'green'
            elif reservation.status in [Reservation.STATUS_CANCELLED, Reservation.STATUS_NO_SHOW]:
                color = 'red'

            # Get service information
            service_name = "Unknown Service"
            duration = 60  # default
            price = 0
            
            if reservation.reservation_services.exists():
                first_service = reservation.reservation_services.first()
                service_name = first_service.service.name
                duration = first_service.service.duration_minutes
                price = float(first_service.total_price)

            appointment = {
                'id': str(reservation.id),
                'customerName': f"{reservation.guest.first_name} {reservation.guest.last_name}".strip(),
                'serviceName': f"{service_name} ({duration} min)",
                'duration': duration,
                'startTime': reservation.start_time.strftime('%H:%M'),
                'endTime': reservation.end_time.strftime('%H:%M'),
                'status': reservation.status,
                'room': reservation.location.name if reservation.location else None,
                'price': price,
                'staffId': employee_id,
                'color': color,
                'customerId': str(reservation.guest.id),
                'serviceId': str(reservation.reservation_services.first().service.id) if reservation.reservation_services.exists() else None,
                'notes': reservation.notes or ''
            }
            appointments.append(appointment)

        # Convert staff to spa staff format
        spa_staff = []
        for employee in staff:
            spa_staff.append({
                'id': str(employee.id),
                'name': f"{employee.user.first_name} {employee.user.last_name}".strip(),
                'displayName': employee.user.first_name or employee.user.username,
                'avatar': None,  # Could be extended to include avatar
                'isActive': employee.active,
                'services': [str(service.id) for service in employee.services.all()]
            })

        return response.Response({
            'appointments': appointments,
            'staff': spa_staff,
            'date': date
        })

    @action(detail=False, methods=['get'], url_path='staff')
    def get_staff(self, request):
        """
        Get all active staff members
        """
        staff = Employee.objects.filter(active=True).select_related('user').prefetch_related('services')
        
        spa_staff = []
        for employee in staff:
            spa_staff.append({
                'id': str(employee.id),
                'name': f"{employee.user.first_name} {employee.user.last_name}".strip(),
                'displayName': employee.user.first_name or employee.user.username,
                'avatar': None,
                'isActive': employee.active,
                'services': [str(service.id) for service in employee.services.all()]
            })

        return response.Response(spa_staff)

    @action(detail=False, methods=['post'], url_path='appointments')
    def create_appointment(self, request):
        """
        Create a new appointment/reservation
        """
        # Extract data from spa format
        data = request.data
        
        # Map spa appointment data to reservation format
        reservation_data = {
            'guest': data.get('customerId'),
            'start_time': data.get('startTime'),
            'end_time': data.get('endTime'),
            'notes': data.get('notes', ''),
            'status': Reservation.STATUS_BOOKED
        }
        
        # Add location if provided
        if data.get('room'):
            try:
                location = Location.objects.get(name=data['room'])
                reservation_data['location'] = location.id
            except Location.DoesNotExist:
                pass

        # Create reservation
        serializer = self.get_serializer(data=reservation_data)
        if serializer.is_valid():
            reservation = serializer.save()
            
            # Add employee assignment if staffId provided
            if data.get('staffId'):
                try:
                    employee = Employee.objects.get(id=data['staffId'])
                    from employees.models import ReservationEmployeeAssignment
                    ReservationEmployeeAssignment.objects.create(
                        reservation=reservation,
                        employee=employee,
                        role_in_service='Primary Therapist'
                    )
                except Employee.DoesNotExist:
                    pass

            # Add service if serviceId provided
            if data.get('serviceId'):
                try:
                    from services.models import Service
                    service = Service.objects.get(id=data['serviceId'])
                    from .models import ReservationService
                    ReservationService.objects.create(
                        reservation=reservation,
                        service=service,
                        quantity=1
                    )
                except Service.DoesNotExist:
                    pass

            return response.Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put', 'patch'], url_path='appointments/(?P<appointment_id>[^/.]+)')
    def update_appointment(self, request, appointment_id=None):
        """
        Update an existing appointment
        """
        try:
            reservation = Reservation.objects.get(id=appointment_id)
        except Reservation.DoesNotExist:
            return response.Response(
                {"error": "Appointment not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Update reservation data
        data = request.data
        update_data = {}
        
        if 'startTime' in data:
            update_data['start_time'] = data['startTime']
        if 'endTime' in data:
            update_data['end_time'] = data['endTime']
        if 'notes' in data:
            update_data['notes'] = data['notes']
        if 'status' in data:
            update_data['status'] = data['status']

        serializer = self.get_serializer(reservation, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return response.Response(serializer.data)
        
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Make this a collection-level action so no ViewSet PK is required
    @action(detail=False, methods=['patch'], url_path='appointments/(?P<appointment_id>[^/.]+)')
    def update_appointment(self, request, appointment_id=None):
        """
        Update an appointment
        """
        try:
            reservation = Reservation.objects.get(id=appointment_id)
            
            # Update basic fields
            if 'startTime' in request.data:
                # Parse the time and update start_time in spa timezone
                time_str = request.data['startTime']
                date_str = reservation.start_time.strftime('%Y-%m-%d')  # Use existing date
                start_datetime = SPA_TIMEZONE.localize(datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M'))
                reservation.start_time = start_datetime
                
            if 'endTime' in request.data:
                time_str = request.data['endTime']
                date_str = reservation.end_time.strftime('%Y-%m-%d')  # Use existing date
                end_datetime = SPA_TIMEZONE.localize(datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M'))
                reservation.end_time = end_datetime
                
            if 'staffId' in request.data:
                # Update staff assignment
                try:
                    new_employee = Employee.objects.get(id=request.data['staffId'])
                    # Remove old assignments
                    reservation.employee_assignments.all().delete()
                    # Create new assignment
                    from employees.models import ReservationEmployeeAssignment
                    ReservationEmployeeAssignment.objects.create(
                        reservation=reservation,
                        employee=new_employee,
                        is_primary=True
                    )
                except Employee.DoesNotExist:
                    return response.Response(
                        {"error": "Staff member not found"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            reservation.save()
            
            # Return updated appointment data
            appointment_data = {
                'id': str(reservation.id),
                'customerName': reservation.guest_name or 'Unknown Guest',
                'serviceName': 'Service',  # You might want to get this from reservation_services
                'duration': int((reservation.end_time - reservation.start_time).total_seconds() / 60),
                'startTime': reservation.start_time.strftime('%H:%M'),
                'endTime': reservation.end_time.strftime('%H:%M'),
                'status': 'confirmed' if reservation.status == 'booked' else reservation.status,
                'room': reservation.location.name if reservation.location else None,
                'price': 0,
                'staffId': str(reservation.employee_assignments.first().employee.id) if reservation.employee_assignments.exists() else None,
                'color': 'green' if reservation.status == 'booked' else 'grey',
                'customerId': str(reservation.guest.id) if reservation.guest else '',
                'serviceId': None,
                'notes': reservation.notes or ''
            }
            
            return response.Response(appointment_data, status=status.HTTP_200_OK)
            
        except Reservation.DoesNotExist:
            return response.Response(
                {"error": "Appointment not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return response.Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    # Collection-level delete to match /spa-scheduling/appointments/<id>/
    @action(detail=False, methods=['delete'], url_path='appointments/(?P<appointment_id>[^/.]+)')
    def delete_appointment(self, request, appointment_id=None):
        """
        Delete an appointment
        """
        try:
            reservation = Reservation.objects.get(id=appointment_id)
            reservation.delete()
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Reservation.DoesNotExist:
            return response.Response(
                {"error": "Appointment not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'], url_path='available-slots/(?P<staff_id>[^/.]+)/(?P<date>[^/.]+)')
    def get_available_slots(self, request, staff_id=None, date=None):
        """
        Get available time slots for a staff member on a specific date
        """
        try:
            target_date = datetime.strptime(date, '%Y-%m-%d').date()
            employee = Employee.objects.get(id=staff_id)
        except (ValueError, Employee.DoesNotExist):
            return response.Response(
                {"error": "Invalid date or staff member"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get start and end of the day (6:00 AM to 1:00 AM next day) in spa timezone
        start_datetime = SPA_TIMEZONE.localize(datetime.combine(target_date, time(hour=6)))
        end_datetime = SPA_TIMEZONE.localize(datetime.combine(target_date + timedelta(days=1), time(hour=1)))

        # Get existing reservations for this staff member on this date
        existing_reservations = Reservation.objects.filter(
            employee_assignments__employee=employee,
            start_time__gte=start_datetime,
            start_time__lt=end_datetime,
            status__in=[Reservation.STATUS_BOOKED, Reservation.STATUS_CHECKED_IN, Reservation.STATUS_IN_SERVICE]
        ).order_by('start_time')

        # Generate available slots (every 30 minutes from 6:00 AM to 00:30 AM next day)
        available_slots = []
        current_time = start_datetime  # 6:00 AM
        end_time = start_datetime + timedelta(hours=18, minutes=30)  # 00:30 AM next day

        while current_time < end_time:
            slot_end = current_time + timedelta(minutes=30)
            
            # Check if this slot conflicts with existing reservations
            conflicts = existing_reservations.filter(
                start_time__lt=slot_end,
                end_time__gt=current_time
            )
            
            if not conflicts.exists():
                available_slots.append(current_time.strftime('%H:%M'))
            
            current_time += timedelta(minutes=30)

        return response.Response(available_slots)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        from guardian.shortcuts import get_objects_for_user
        return get_objects_for_user(user, 'reservations.view_reservation', qs)
