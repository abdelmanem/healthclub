from django.db import migrations
from pos.migration_utils import safe_add_field_to_model, safe_drop_field_from_model


def ensure_deposit_expiry_date_fields(apps, schema_editor):
    """Ensure expiry_date field exists on both deposit tables"""
    safe_add_field_to_model(apps, schema_editor, 'pos', 'deposit', 'expiry_date', 'date NULL')
    safe_add_field_to_model(apps, schema_editor, 'pos', 'historicaldeposit', 'expiry_date', 'date NULL')


def reverse_ensure_deposit_expiry_date_fields(apps, schema_editor):
    """Remove expiry_date fields if they exist"""
    safe_drop_field_from_model(apps, schema_editor, 'pos', 'deposit', 'expiry_date')
    safe_drop_field_from_model(apps, schema_editor, 'pos', 'historicaldeposit', 'expiry_date')


class Migration(migrations.Migration):

    dependencies = [
        ("pos", "0013_deposit_updated_at"),
    ]

    operations = [
        migrations.RunPython(
            ensure_deposit_expiry_date_fields,
            reverse_ensure_deposit_expiry_date_fields
        ),
    ]


