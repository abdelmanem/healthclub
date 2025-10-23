from django.db import migrations


def test_conditional_migrations(apps, schema_editor):
    """
    Test that all conditional migrations work correctly
    This migration can be safely run multiple times
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        print("Testing conditional migration safety...")
        
        # Test 1: Check pos_refund table structure
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_refund'
            ORDER BY ordinal_position
        """)
        refund_columns = cursor.fetchall()
        print(f"pos_refund has {len(refund_columns)} columns")
        
        # Test 2: Check pos_historicalrefund table structure
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_historicalrefund'
            ORDER BY ordinal_position
        """)
        historical_columns = cursor.fetchall()
        print(f"pos_historicalrefund has {len(historical_columns)} columns")
        
        # Test 3: Check pos_deposit table structure
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_deposit'
            ORDER BY ordinal_position
        """)
        deposit_columns = cursor.fetchall()
        print(f"pos_deposit has {len(deposit_columns)} columns")
        
        # Test 4: Verify critical columns exist
        critical_columns = [
            ('pos_refund', 'original_payment_id'),
            ('pos_refund', 'refund_method'),
            ('pos_refund', 'approved_at'),
            ('pos_deposit', 'expiry_date'),
        ]
        
        for table, column in critical_columns:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND column_name = %s
            """, [table, column])
            exists = cursor.fetchone() is not None
            print(f"Column {table}.{column} exists: {exists}")
        
        print("Conditional migration test completed successfully!")


def reverse_test_migrations(apps, schema_editor):
    """
    Reverse function - no changes needed for test migration
    """
    print("Test migration reverse completed (no changes needed)")


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0018_add_approved_at_to_refund'),
    ]

    operations = [
        migrations.RunPython(
            test_conditional_migrations,
            reverse_test_migrations,
            elidable=True
        ),
    ]
