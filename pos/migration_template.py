"""
Template for creating safe database migrations that check for column existence.

This template shows how to create migrations that won't fail if columns already exist.
Use this pattern for any AddField operations that might conflict with existing schema.
"""

from django.db import migrations, models
from pos.migration_utils import safe_add_field_to_model, safe_drop_field_from_model


def add_new_field_safely(apps, schema_editor):
    """
    Example: Add a new field to a model safely.
    Replace 'model_name', 'field_name', and 'field_definition' with your actual values.
    """
    # For regular models
    safe_add_field_to_model(
        apps, schema_editor, 
        'pos',  # app_label
        'model_name',  # model_name (e.g., 'deposit', 'payment', 'refund')
        'field_name',  # field_name (e.g., 'new_field')
        'field_definition'  # SQL definition (e.g., 'varchar(100) NULL', 'integer DEFAULT 0')
    )
    
    # For historical models (if using django-simple-history)
    safe_add_field_to_model(
        apps, schema_editor,
        'pos',  # app_label
        'historicalmodel_name',  # historical model name
        'field_name',  # field_name
        'field_definition'  # SQL definition
    )


def remove_field_safely(apps, schema_editor):
    """
    Example: Remove a field from a model safely.
    """
    # For regular models
    safe_drop_field_from_model(
        apps, schema_editor,
        'pos',  # app_label
        'model_name',  # model_name
        'field_name'  # field_name
    )
    
    # For historical models
    safe_drop_field_from_model(
        apps, schema_editor,
        'pos',  # app_label
        'historicalmodel_name',  # historical model name
        'field_name'  # field_name
    )


class Migration(migrations.Migration):
    """
    Example migration class.
    Replace the dependencies and operations with your actual migration.
    """
    
    dependencies = [
        ('pos', 'previous_migration_name'),
    ]

    operations = [
        migrations.RunPython(
            add_new_field_safely,
            remove_field_safely
        ),
    ]


# Alternative: Using RunSQL with conditional checks
def add_field_with_sql(apps, schema_editor):
    """
    Example using raw SQL with conditional checks.
    Use this when you need more complex field definitions.
    """
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s 
                AND column_name=%s
            """, ['pos_your_table', 'your_field'])
            
            if not cursor.fetchone():
                # Column doesn't exist, add it
                cursor.execute("""
                    ALTER TABLE pos_your_table 
                    ADD COLUMN your_field varchar(255) NULL
                """)


def remove_field_with_sql(apps, schema_editor):
    """
    Example using raw SQL to remove fields conditionally.
    """
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s 
                AND column_name=%s
            """, ['pos_your_table', 'your_field'])
            
            if cursor.fetchone():
                # Column exists, drop it
                cursor.execute("ALTER TABLE pos_your_table DROP COLUMN your_field")


# Example migration using raw SQL
class SQLMigration(migrations.Migration):
    """
    Example migration using raw SQL with conditional checks.
    """
    
    dependencies = [
        ('pos', 'previous_migration_name'),
    ]

    operations = [
        migrations.RunPython(
            add_field_with_sql,
            remove_field_with_sql
        ),
    ]
