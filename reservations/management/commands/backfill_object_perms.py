from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from guardian.shortcuts import assign_perm
import os


class Command(BaseCommand):
    help = "Backfill object permissions for reservations and invoices"

    def handle(self, *args, **options):
        from reservations.models import Reservation
        from pos.models import Invoice

        group_name = os.environ.get('FRONT_OFFICE_GROUP_NAME', 'Front Office')
        group = None
        try:
            group = Group.objects.get(name=group_name)
        except Group.DoesNotExist:
            self.stdout.write(self.style.WARNING(f"Group '{group_name}' not found; skipping group grants"))

        # Reservations: grant to Front Office and to assigned therapists
        qs_res = Reservation.objects.all()
        count_res = 0
        for res in qs_res.iterator():
            if group:
                assign_perm('reservations.view_reservation', group, res)
            for assignment in res.employee_assignments.select_related('employee__user').all():
                user = assignment.employee.user
                assign_perm('reservations.view_reservation', user, res)
                assign_perm('reservations.change_reservation', user, res)
            count_res += 1
        self.stdout.write(self.style.SUCCESS(f"Processed reservations: {count_res}"))

        # Invoices: grant to Front Office and assigned therapists
        qs_inv = Invoice.objects.select_related('reservation').all()
        count_inv = 0
        for inv in qs_inv.iterator():
            if group:
                assign_perm('pos.view_invoice', group, inv)
            if inv.reservation:
                for assignment in inv.reservation.employee_assignments.select_related('employee__user').all():
                    user = assignment.employee.user
                    assign_perm('pos.view_invoice', user, inv)
            count_inv += 1
        self.stdout.write(self.style.SUCCESS(f"Processed invoices: {count_inv}"))

