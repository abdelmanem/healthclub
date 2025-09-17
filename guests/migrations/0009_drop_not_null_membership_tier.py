from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('guests', '0008_fix_invalid_membership_tier_refs'),
        ('config', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                ("ALTER TABLE guests_guest ALTER COLUMN membership_tier DROP NOT NULL;", None),
                ("ALTER TABLE guests_historicalguest ALTER COLUMN membership_tier DROP NOT NULL;", None),
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]


