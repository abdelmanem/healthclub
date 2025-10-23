from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("pos", "0014_add_missing_deposit_fields"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE \"pos_deposit\" "
                "ADD COLUMN IF NOT EXISTS \"expiry_date\" date NULL;"
            ),
            reverse_sql=(
                "ALTER TABLE \"pos_deposit\" "
                "DROP COLUMN IF EXISTS \"expiry_date\";"
            ),
        ),
    ]


