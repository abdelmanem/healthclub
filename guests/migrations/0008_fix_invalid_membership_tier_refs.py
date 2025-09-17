from django.db import migrations


def null_invalid_membership_tiers(apps, schema_editor):
    Guest = apps.get_model('guests', 'Guest')
    MembershipTier = apps.get_model('config', 'MembershipTier')

    # Collect valid names
    valid_names = set(MembershipTier.objects.values_list('name', flat=True))

    # Guests store FK by name (to_field='name'). Null any that point to missing names
    for guest in Guest.objects.all().only('id', 'membership_tier_id'):
        tier_name = guest.membership_tier_id  # because to_field='name'
        if tier_name and tier_name not in valid_names:
            Guest.objects.filter(id=guest.id).update(membership_tier=None)


def reverse_noop(apps, schema_editor):
    # Nothing to restore
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('guests', '0007_auto_20250915_2306'),
        ('config', '0001_initial'),
    ]

    operations = [
        # Ensure DB column allows NULLs before attempting to null invalid refs
        migrations.RunSQL(
            sql=[
                ("ALTER TABLE guests_guest ALTER COLUMN membership_tier DROP NOT NULL;", None),
                ("ALTER TABLE guests_historicalguest ALTER COLUMN membership_tier DROP NOT NULL;", None),
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(null_invalid_membership_tiers, reverse_noop),
    ]


