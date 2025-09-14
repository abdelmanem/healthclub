from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Get current authenticated user information
    """
    user = request.user
    
    # Create a simple response structure for now
    response_data = {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "role": {
                "id": 1,
                "name": "Administrator" if user.is_superuser else "User",
                "description": "System Administrator" if user.is_superuser else "Regular User"
            }
        },
        "permissions": {
            "guests.guest": ["add", "change", "delete", "view"] if user.is_superuser else [],
            "reservations.reservation": ["add", "change", "delete", "view"] if user.is_superuser else [],
            "services.service": ["add", "change", "delete", "view"] if user.is_superuser else []
        },
        "groups": []
    }
    
    return Response(response_data)