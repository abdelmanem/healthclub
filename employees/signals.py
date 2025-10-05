from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import ReservationEmployeeAssignment


@receiver(post_save, sender=ReservationEmployeeAssignment)
def grant_perms_on_assignment(sender, instance: ReservationEmployeeAssignment, created, **kwargs):
    if not created:
        return
    from guardian.shortcuts import assign_perm

    user = instance.employee.user
    reservation = instance.reservation
    assign_perm('reservations.view_reservation', user, reservation)
    assign_perm('reservations.change_reservation', user, reservation)


@receiver(post_delete, sender=ReservationEmployeeAssignment)
def revoke_perms_on_assignment_delete(sender, instance: ReservationEmployeeAssignment, **kwargs):
    from guardian.shortcuts import remove_perm

    user = instance.employee.user
    reservation = instance.reservation
    remove_perm('reservations.view_reservation', user, reservation)
    remove_perm('reservations.change_reservation', user, reservation)


# --- Keep reservation.employee FK in sync with primary assignment ---
@receiver(post_save, sender=ReservationEmployeeAssignment)
def sync_reservation_employee_on_save(sender, instance: ReservationEmployeeAssignment, created, **kwargs):
    try:
        # Only sync when this is or becomes the Primary Therapist
        if getattr(instance, 'role_in_service', None) == 'Primary Therapist':
            reservation = instance.reservation
            if reservation and getattr(instance, 'employee_id', None):
                # Update FK only if changed to avoid extra saves
                if getattr(reservation, 'employee_id', None) != instance.employee_id:
                    reservation.employee_id = instance.employee_id
                    reservation.save(update_fields=['employee'])
    except Exception:
        # Best-effort sync; do not break request lifecycle
        pass


@receiver(post_delete, sender=ReservationEmployeeAssignment)
def sync_reservation_employee_on_delete(sender, instance: ReservationEmployeeAssignment, **kwargs):
    try:
        # If we deleted the primary assignment, try to re-derive FK
        if getattr(instance, 'role_in_service', None) == 'Primary Therapist':
            reservation = instance.reservation
            if not reservation:
                return
            # Prefer another primary if exists
            primary = reservation.employee_assignments.filter(role_in_service='Primary Therapist').first()
            if primary:
                if getattr(reservation, 'employee_id', None) != primary.employee_id:
                    reservation.employee_id = primary.employee_id
                    reservation.save(update_fields=['employee'])
                return
            # Else fall back to any assignment
            any_assign = reservation.employee_assignments.first()
            new_emp_id = getattr(any_assign, 'employee_id', None) if any_assign else None
            if getattr(reservation, 'employee_id', None) != new_emp_id:
                reservation.employee_id = new_emp_id
                reservation.save(update_fields=['employee'])
    except Exception:
        # Best-effort sync
        pass
