from rest_framework.permissions import BasePermission, SAFE_METHODS
from guardian.shortcuts import assign_perm, get_objects_for_user


class ObjectPermissionsOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        model_name = obj._meta.model_name
        app_label = obj._meta.app_label
        perm_codename = f"change_{model_name}"
        # Allow owners via guardian change permission on the object
        return request.user.has_perm(f"{app_label}.{perm_codename}", obj)

