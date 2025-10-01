# Spa Scheduling Integration

This document describes the integration of the spa scheduling layout with the backend server.

## Overview

The spa scheduling system provides a professional appointment management interface similar to spa management software, with real-time data integration from the Django backend.

## Backend Integration

### API Endpoints

The following endpoints have been added to support spa scheduling:

- `GET /api/spa-scheduling/scheduling-data/{date}/` - Get all scheduling data for a specific date
- `GET /api/spa-scheduling/staff/` - Get all active staff members
- `POST /api/spa-scheduling/appointments/` - Create a new appointment
- `PATCH /api/spa-scheduling/appointments/{id}/` - Update an existing appointment
- `DELETE /api/spa-scheduling/appointments/{id}/` - Delete an appointment
- `GET /api/spa-scheduling/available-slots/{staff_id}/{date}/` - Get available time slots

### Data Models

The system integrates with existing Django models:

- **Reservations**: Core appointment data
- **Employees**: Staff members who can be assigned to appointments
- **Locations**: Rooms/locations where services are provided
- **Services**: Available spa services
- **Guests**: Customers making appointments

### Data Flow

1. **Frontend** requests scheduling data for a specific date
2. **Backend** queries reservations, employees, and related data
3. **Backend** transforms data into spa scheduling format
4. **Frontend** displays appointments in the grid layout
5. **User** can create, update, or delete appointments
6. **Changes** are synchronized with the backend in real-time

## Frontend Components

### SpaLayout
- Purple header with spa branding
- Main navigation with dropdown menus
- Sub-navigation tabs for different views
- Left sidebar with calendar and walk-ins

### AppointmentSchedulingGrid
- Staff columns with appointment blocks
- Time axis with 30-minute intervals
- Color-coded appointment status
- Real-time data loading and updates
- Responsive design for mobile devices

## Features

### Real-time Data
- Automatic data loading on date changes
- Refresh functionality
- Error handling with retry options
- Loading states

### Appointment Management
- View appointments by staff member
- Color-coded status indicators
- Service and pricing information
- Room assignments

### Staff Management
- Active staff member display
- Service qualifications
- Availability tracking

## Usage

1. Navigate to `/spa-scheduling` in the application
2. Select a date using the date navigation
3. View appointments in the grid layout
4. Use the staff dropdown to filter by specific staff members
5. Click refresh to reload data
6. Create new appointments using the + button (future feature)

## Technical Details

### Backend Files
- `reservations/spa_scheduling_views.py` - API endpoints
- `healthclub/urls.py` - URL routing
- Integration with existing models and serializers

### Frontend Files
- `components/common/SpaLayout.tsx` - Main layout component
- `components/reservation/AppointmentSchedulingGrid.tsx` - Grid component
- `services/spaScheduling.ts` - API service layer
- `pages/SpaScheduling.tsx` - Page component

### Dependencies
- React with TypeScript
- Material-UI for components
- Axios for API calls
- Django REST Framework for backend API

## Future Enhancements

- Real-time updates with WebSocket integration
- Drag-and-drop appointment rescheduling
- Appointment creation and editing forms
- Staff availability management
- Conflict detection and resolution
- Mobile app integration
- Notification system for appointment changes

## Troubleshooting

### Common Issues

1. **Data not loading**: Check API endpoint URLs and authentication
2. **Staff not showing**: Verify employee records are active
3. **Appointments not displaying**: Check reservation data and date format
4. **Mobile layout issues**: Ensure responsive design is enabled

### Debug Steps

1. Check browser console for API errors
2. Verify backend API endpoints are accessible
3. Check Django logs for server errors
4. Validate data format matches expected schema

## Security

- All endpoints require authentication
- Permission-based access control
- Data validation on both frontend and backend
- Secure API communication with JWT tokens
