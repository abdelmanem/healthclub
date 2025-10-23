from django.db import migrations, models


def check_and_add_approved_at(apps, schema_editor):
    """
    Safely add approved_at column if it doesn't exist
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Check if approved_at column exists in pos_refund
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pos_refund' AND column_name = 'approved_at'
        """)
        refund_has_column = cursor.fetchone() is not None
        
        # Check if approved_at column exists in pos_historicalrefund
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pos_historicalrefund' AND column_name = 'approved_at'
        """)
        historical_has_column = cursor.fetchone() is not None
        
        # Add approved_at to pos_refund if missing
        if not refund_has_column:
            try:
                cursor.execute("ALTER TABLE pos_refund ADD COLUMN approved_at timestamp with time zone")
                print("Added approved_at column to pos_refund")
            except Exception as e:
                print(f"Could not add approved_at to pos_refund: {e}")
        else:
            print("approved_at column already exists in pos_refund")
        
        # Add approved_at to pos_historicalrefund if missing
        if not historical_has_column:
            try:
                cursor.execute("ALTER TABLE pos_historicalrefund ADD COLUMN approved_at timestamp with time zone")
                print("Added approved_at column to pos_historicalrefund")
            except Exception as e:
                print(f"Could not add approved_at to pos_historicalrefund: {e}")
        else:
            print("approved_at column already exists in pos_historicalrefund")


def reverse_add_approved_at(apps, schema_editor):
    """
    Reverse function - remove approved_at column if needed
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        try:
            cursor.execute("ALTER TABLE pos_refund DROP COLUMN IF EXISTS approved_at")
            cursor.execute("ALTER TABLE pos_historicalrefund DROP COLUMN IF EXISTS approved_at")
            print("Removed approved_at columns")
        except Exception as e:
            print(f"Could not remove approved_at columns: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0017_fix_refund_model'),
    ]

    operations = [
        migrations.RunPython(
            check_and_add_approved_at,
            reverse_add_approved_at,
            elidable=True
        ),
    ]
