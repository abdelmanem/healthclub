from django.db import migrations, models


def check_and_add_columns(apps, schema_editor):
    """
    Safely add missing columns to refund tables with conditional checks
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Check existing columns in pos_refund table
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pos_refund'
        """)
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        # Define columns to add if missing
        columns_to_add = [
            ('original_payment_id', 'bigint'),
            ('refund_method', 'character varying'),
            ('transaction_id', 'character varying'),
            ('reference', 'character varying'),
            ('notes', 'text'),
            ('processed_by_id', 'bigint'),
        ]
        
        # Add missing columns
        for column_name, data_type in columns_to_add:
            if column_name not in existing_columns:
                try:
                    if data_type == 'bigint':
                        cursor.execute(f"ALTER TABLE pos_refund ADD COLUMN {column_name} bigint")
                    elif data_type == 'character varying':
                        cursor.execute(f"ALTER TABLE pos_refund ADD COLUMN {column_name} character varying(100)")
                    elif data_type == 'text':
                        cursor.execute(f"ALTER TABLE pos_refund ADD COLUMN {column_name} text")
                    print(f"Added column {column_name} to pos_refund")
                except Exception as e:
                    print(f"Could not add column {column_name}: {e}")
        
        # Check existing columns in pos_historicalrefund table
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pos_historicalrefund'
        """)
        existing_historical_columns = [row[0] for row in cursor.fetchall()]
        
        # Add missing columns to historical table
        for column_name, data_type in columns_to_add:
            if column_name not in existing_historical_columns:
                try:
                    if data_type == 'bigint':
                        cursor.execute(f"ALTER TABLE pos_historicalrefund ADD COLUMN {column_name} bigint")
                    elif data_type == 'character varying':
                        cursor.execute(f"ALTER TABLE pos_historicalrefund ADD COLUMN {column_name} character varying(100)")
                    elif data_type == 'text':
                        cursor.execute(f"ALTER TABLE pos_historicalrefund ADD COLUMN {column_name} text")
                    print(f"Added column {column_name} to pos_historicalrefund")
                except Exception as e:
                    print(f"Could not add column {column_name} to historical table: {e}")


def reverse_add_columns(apps, schema_editor):
    """
    Reverse function - remove added columns if needed
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        columns_to_remove = [
            'original_payment_id',
            'refund_method', 
            'transaction_id',
            'reference',
            'notes',
            'processed_by_id',
        ]
        
        for column_name in columns_to_remove:
            try:
                cursor.execute(f"ALTER TABLE pos_refund DROP COLUMN IF EXISTS {column_name}")
                cursor.execute(f"ALTER TABLE pos_historicalrefund DROP COLUMN IF EXISTS {column_name}")
                print(f"Removed column {column_name}")
            except Exception as e:
                print(f"Could not remove column {column_name}: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0016_alter_historicaldeposit_expiry_date'),
    ]

    operations = [
        migrations.RunPython(
            check_and_add_columns,
            reverse_add_columns,
            elidable=True
        ),
    ]
