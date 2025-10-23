"""
Utility functions for safe database migrations
"""


def safe_add_column(schema_editor, table_name, column_name, column_definition):
    """
    Safely add a column to a table if it doesn't already exist.
    
    Args:
        schema_editor: Django schema editor instance
        table_name: Name of the table (e.g., 'pos_deposit')
        column_name: Name of the column to add
        column_definition: SQL column definition (e.g., 'date NULL')
    """
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s 
                AND column_name=%s
            """, [table_name, column_name])
            
            if not cursor.fetchone():
                # Column doesn't exist, add it
                cursor.execute(f"""
                    ALTER TABLE {table_name} 
                    ADD COLUMN {column_name} {column_definition}
                """)


def safe_drop_column(schema_editor, table_name, column_name):
    """
    Safely drop a column from a table if it exists.
    
    Args:
        schema_editor: Django schema editor instance
        table_name: Name of the table (e.g., 'pos_deposit')
        column_name: Name of the column to drop
    """
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s 
                AND column_name=%s
            """, [table_name, column_name])
            
            if cursor.fetchone():
                # Column exists, drop it
                cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name}")


def safe_add_field_to_model(apps, schema_editor, app_label, model_name, field_name, field_definition):
    """
    Safely add a field to a Django model's database table.
    
    Args:
        apps: Django apps registry
        schema_editor: Django schema editor instance
        app_label: App label (e.g., 'pos')
        model_name: Model name (e.g., 'deposit')
        field_name: Field name (e.g., 'expiry_date')
        field_definition: SQL field definition (e.g., 'date NULL')
    """
    table_name = f"{app_label}_{model_name}"
    safe_add_column(schema_editor, table_name, field_name, field_definition)


def safe_drop_field_from_model(apps, schema_editor, app_label, model_name, field_name):
    """
    Safely drop a field from a Django model's database table.
    
    Args:
        apps: Django apps registry
        schema_editor: Django schema editor instance
        app_label: App label (e.g., 'pos')
        model_name: Model name (e.g., 'deposit')
        field_name: Field name (e.g., 'expiry_date')
    """
    table_name = f"{app_label}_{model_name}"
    safe_drop_column(schema_editor, table_name, field_name)
