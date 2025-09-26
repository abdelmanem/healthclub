from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from .models import Reservation, mark_guest_checked_out, mark_guest_in_house, HousekeepingTask


@receiver(pre_save, sender=Reservation)
def handle_checkin_checkout(sender, instance: Reservation, **kwargs):
    if not instance.pk:
        return
    try:
        previous = Reservation.objects.get(pk=instance.pk)
    except Reservation.DoesNotExist:
        return

    if previous.status != instance.status:
        from django.utils import timezone
        now = timezone.now()
        if instance.status == Reservation.STATUS_CHECKED_IN:
            instance.checked_in_at = now
            mark_guest_in_house(instance.guest)
            # Mark location as occupied when guest checks in
            if getattr(instance, 'location_id', None):
                try:
                    instance.location.is_occupied = True
                    instance.location.save(update_fields=["is_occupied"])
                except Exception:
                    pass
        elif instance.status == Reservation.STATUS_IN_SERVICE:
            instance.in_service_at = now
        elif instance.status == Reservation.STATUS_COMPLETED:
            instance.completed_at = now
        elif instance.status == Reservation.STATUS_CHECKED_OUT:
            instance.checked_out_at = now
            mark_guest_checked_out(instance.guest)
            # Free up the location and mark as dirty after checkout
            if getattr(instance, 'location_id', None):
                try:
                    instance.location.is_occupied = False
                    instance.location.is_clean = False
                    instance.location.save(update_fields=["is_occupied", "is_clean"])
                    # Create housekeeping task automatically
                    HousekeepingTask.objects.create(location=instance.location, reservation=instance)
                except Exception:
                    pass
        elif instance.status == Reservation.STATUS_CANCELLED:
            instance.cancelled_at = now
        elif instance.status == Reservation.STATUS_NO_SHOW:
            instance.no_show_recorded_at = now


@receiver(post_save, sender=Reservation)
def grant_group_view_on_reservation(sender, instance: Reservation, created, **kwargs):
    if not created:
        return
    import os
    from django.contrib.auth.models import Group
    from guardian.shortcuts import assign_perm

    group_name = os.environ.get('FRONT_OFFICE_GROUP_NAME', 'Front Office')
    try:
        group = Group.objects.get(name=group_name)
    except Group.DoesNotExist:
        return
    assign_perm('reservations.view_reservation', group, instance)

