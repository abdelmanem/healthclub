from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Invoice


@receiver(post_save, sender=Invoice)
def grant_view_on_invoice(sender, instance: Invoice, created, **kwargs):
    if not created:
        return
    from guardian.shortcuts import assign_perm
    from django.contrib.auth.models import Group
    import os

    # Front Office group
    group_name = os.environ.get('FRONT_OFFICE_GROUP_NAME', 'Front Office')
    try:
        front_office = Group.objects.get(name=group_name)
        assign_perm('pos.view_invoice', front_office, instance)
    except Group.DoesNotExist:
        pass

    # Assigned therapists on the reservation, if present
    reservation = instance.reservation
    if reservation:
        for assignment in reservation.employee_assignments.select_related('employee__user').all():
            user = assignment.employee.user
            assign_perm('pos.view_invoice', user, instance)

