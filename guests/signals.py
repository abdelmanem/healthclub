from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import GuestAddress, Guest


@receiver(post_save, sender=GuestAddress)
def sync_guest_country_on_address_save(sender, instance, created, **kwargs):
    """
    Sync the guest's country field with their primary address country.
    This ensures that when an address is created or updated, the guest's
    country field is automatically updated to match their primary address.
    """
    guest = instance.guest
    
    # Get the primary address for this guest
    primary_address = guest.addresses.filter(is_primary=True).first()
    
    if primary_address:
        # Update guest's country to match primary address country
        if guest.country != primary_address.country:
            guest.country = primary_address.country
            guest.save(update_fields=['country'])


@receiver(post_delete, sender=GuestAddress)
def sync_guest_country_on_address_delete(sender, instance, **kwargs):
    """
    When an address is deleted, check if it was the primary address
    and update the guest's country accordingly.
    """
    guest = instance.guest
    
    # Get the new primary address (if any)
    primary_address = guest.addresses.filter(is_primary=True).first()
    
    if primary_address:
        # Update guest's country to match the new primary address
        if guest.country != primary_address.country:
            guest.country = primary_address.country
            guest.save(update_fields=['country'])
    else:
        # No primary address left, clear the guest's country
        if guest.country:
            guest.country = ''
            guest.save(update_fields=['country'])
