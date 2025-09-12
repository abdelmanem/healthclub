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

