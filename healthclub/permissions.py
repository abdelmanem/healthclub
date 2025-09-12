from rest_framework.permissions import BasePermission, SAFE_METHODS


class ObjectPermissionsOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        model_name = obj._meta.model_name
        app_label = obj._meta.app_label
        if request.user.is_staff or request.user.is_superuser:
            return True
        if request.method in SAFE_METHODS:
            perm_codename = f"view_{model_name}"
            return request.user.has_perm(f"{app_label}.{perm_codename}", obj)
        # Separate delete permission
        if request.method == 'DELETE':
            perm_codename = f"delete_{model_name}"
            return request.user.has_perm(f"{app_label}.{perm_codename}", obj)
        perm_codename = f"change_{model_name}"
        return request.user.has_perm(f"{app_label}.{perm_codename}", obj)

