# Safe Database Migration Patterns

This document explains how to create database migrations that won't fail if columns already exist, making them more robust and reusable.

## The Problem

Standard Django migrations can fail if:
- Columns already exist (duplicate column errors)
- Columns don't exist when trying to drop them
- Multiple developers create conflicting migrations
- Migrations are run out of order

## The Solution

We've created utility functions that check for column existence before performing operations.

## Available Utilities

### `safe_add_field_to_model(apps, schema_editor, app_label, model_name, field_name, field_definition)`

Safely adds a field to a Django model's database table.

**Parameters:**
- `app_label`: App name (e.g., 'pos')
- `model_name`: Model name (e.g., 'deposit', 'payment')
- `field_name`: Field name (e.g., 'expiry_date')
- `field_definition`: SQL field definition (e.g., 'date NULL', 'varchar(100) NULL')

### `safe_drop_field_from_model(apps, schema_editor, app_label, model_name, field_name)`

Safely removes a field from a Django model's database table.

**Parameters:**
- `app_label`: App name (e.g., 'pos')
- `model_name`: Model name (e.g., 'deposit', 'payment')
- `field_name`: Field name (e.g., 'expiry_date')

## Usage Examples

### Example 1: Adding a New Field

```python
from django.db import migrations
from pos.migration_utils import safe_add_field_to_model, safe_drop_field_from_model

def add_expiry_date_field(apps, schema_editor):
    """Add expiry_date field to deposit tables"""
    safe_add_field_to_model(apps, schema_editor, 'pos', 'deposit', 'expiry_date', 'date NULL')
    safe_add_field_to_model(apps, schema_editor, 'pos', 'historicaldeposit', 'expiry_date', 'date NULL')

def remove_expiry_date_field(apps, schema_editor):
    """Remove expiry_date field from deposit tables"""
    safe_drop_field_from_model(apps, schema_editor, 'pos', 'deposit', 'expiry_date')
    safe_drop_field_from_model(apps, schema_editor, 'pos', 'historicaldeposit', 'expiry_date')

class Migration(migrations.Migration):
    dependencies = [
        ('pos', '0013_deposit_updated_at'),
    ]

    operations = [
        migrations.RunPython(
            add_expiry_date_field,
            remove_expiry_date_field
        ),
    ]
```

### Example 2: Using Raw SQL for Complex Operations

```python
from django.db import migrations

def add_complex_field(apps, schema_editor):
    """Add a field with complex constraints"""
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

def remove_complex_field(apps, schema_editor):
    """Remove the field if it exists"""
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s 
                AND column_name=%s
            """, ['pos_your_table', 'your_field'])
            
            if cursor.fetchone():
                cursor.execute("ALTER TABLE pos_your_table DROP COLUMN your_field")

class Migration(migrations.Migration):
    dependencies = [
        ('pos', 'previous_migration'),
    ]

    operations = [
        migrations.RunPython(
            add_complex_field,
            remove_complex_field
        ),
    ]
```

## Best Practices

1. **Always use safe operations** for AddField and RemoveField operations
2. **Include both forward and reverse functions** for proper rollback capability
3. **Test migrations** on a copy of production data
4. **Document complex migrations** with comments explaining the purpose
5. **Use the utility functions** when possible for consistency

## Common Field Definitions

- **Date field**: `'date NULL'`
- **DateTime field**: `'timestamp NULL'`
- **String field**: `'varchar(255) NULL'`
- **Integer field**: `'integer NULL'`
- **Boolean field**: `'boolean DEFAULT false'`
- **Decimal field**: `'decimal(10,2) NULL'`

## Database Support

Currently, the utilities support PostgreSQL. For other databases, you may need to modify the SQL queries in the utility functions.

## Migration Template

Use the `migration_template.py` file as a starting point for new migrations that need to be safe and robust.
