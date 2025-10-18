from django.core.management.base import BaseCommand
from guests.models import Guest


class Command(BaseCommand):
    help = 'Sync guest country fields with their primary address countries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        updated_count = 0
        
        self.stdout.write('Syncing guest countries with primary addresses...')
        
        for guest in Guest.objects.all():
            primary_address = guest.addresses.filter(is_primary=True).first()
            
            if primary_address:
                if guest.country != primary_address.country:
                    if dry_run:
                        self.stdout.write(
                            f'Would update {guest.full_name}: '
                            f'"{guest.country}" -> "{primary_address.country}"'
                        )
                    else:
                        guest.country = primary_address.country
                        guest.save(update_fields=['country'])
                        self.stdout.write(
                            f'Updated {guest.full_name}: '
                            f'"{guest.country}" -> "{primary_address.country}"'
                        )
                    updated_count += 1
            else:
                # No primary address, clear the country if it's set
                if guest.country:
                    if dry_run:
                        self.stdout.write(
                            f'Would clear country for {guest.full_name}: "{guest.country}"'
                        )
                    else:
                        guest.country = ''
                        guest.save(update_fields=['country'])
                        self.stdout.write(
                            f'Cleared country for {guest.full_name}'
                        )
                    updated_count += 1
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'Dry run complete. Would update {updated_count} guests.')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {updated_count} guests.')
            )
