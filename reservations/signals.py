from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Reservation, mark_guest_checked_out, mark_guest_in_house


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
        elif instance.status == Reservation.STATUS_IN_SERVICE:
            instance.in_service_at = now
        elif instance.status == Reservation.STATUS_COMPLETED:
            instance.completed_at = now
        elif instance.status == Reservation.STATUS_CHECKED_OUT:
            instance.checked_out_at = now
            mark_guest_checked_out(instance.guest)
        elif instance.status == Reservation.STATUS_CANCELLED:
            instance.cancelled_at = now
        elif instance.status == Reservation.STATUS_NO_SHOW:
            instance.no_show_recorded_at = now

