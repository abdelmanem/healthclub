from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Clear temporary/transactional data from reservations, guests, and pos apps while preserving configuration."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Run non-interactively and skip confirmation prompt.",
        )
        parser.add_argument(
            "--include-guests",
            action="store_true",
            help="Also delete all guests and their history (NOT reversible).",
        )

    def handle(self, *args, **options):
        confirm = options.get("yes", False)
        include_guests = options.get("include_guests", False)

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "This will delete transactional data (reservations, invoices, payments, etc.).\n"
                "Configuration and master data will be preserved (e.g., locations, payment methods).\n"
                "Re-run with --yes to proceed non-interactively."
            ))
            return

        # Import models locally to avoid app loading side-effects on import
        from reservations.models import (
            Reservation,
            ReservationService,
            Waitlist,
            HousekeepingTask,
        )
        from guests.models import (
            Guest,
            GuestAddress,
            EmergencyContact,
            GuestPreference,
            GuestCommunication,
        )
        from pos.models import (
            Invoice,
            InvoiceItem,
            Payment,
            Refund,
            GiftCard,
            FinancialReport,
        )

        deleted_counts = {}

        with transaction.atomic():
            # POS-related transactional data
            deleted_counts["FinancialReport"] = FinancialReport.objects.all().delete()[0]
            deleted_counts["Refund"] = Refund.objects.all().delete()[0]
            deleted_counts["Payment"] = Payment.objects.all().delete()[0]
            deleted_counts["InvoiceItem"] = InvoiceItem.objects.all().delete()[0]
            deleted_counts["Invoice"] = Invoice.objects.all().delete()[0]
            deleted_counts["GiftCard"] = GiftCard.objects.all().delete()[0]

            # Reservation-related transactional data
            deleted_counts["HousekeepingTask"] = HousekeepingTask.objects.all().delete()[0]
            deleted_counts["Waitlist"] = Waitlist.objects.all().delete()[0]
            deleted_counts["ReservationService"] = ReservationService.objects.all().delete()[0]
            deleted_counts["Reservation"] = Reservation.objects.all().delete()[0]

            # Guests auxiliary data (preserve Guest by default)
            deleted_counts["GuestCommunication"] = GuestCommunication.objects.all().delete()[0]
            deleted_counts["GuestPreference"] = GuestPreference.objects.all().delete()[0]
            deleted_counts["GuestAddress"] = GuestAddress.objects.all().delete()[0]
            deleted_counts["EmergencyContact"] = EmergencyContact.objects.all().delete()[0]

            if include_guests:
                # Warning: this removes guests (master data). Use only for full reset.
                deleted_counts["Guest"] = Guest.objects.all().delete()[0]

        # Summary
        self.stdout.write(self.style.SUCCESS("Temporary data cleared."))
        for model_name, count in deleted_counts.items():
            self.stdout.write(f"- {model_name}: {count} rows deleted")


