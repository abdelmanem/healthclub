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
        if instance.status == Reservation.STATUS_CHECKED_IN:
            mark_guest_in_house(instance.guest)
        elif instance.status == Reservation.STATUS_CHECKED_OUT:
            mark_guest_checked_out(instance.guest)

