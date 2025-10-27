#!/usr/bin/env python
"""
Fix invoice #50 status by recalculating totals
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'healthclub.settings')
django.setup()

from pos.models import Invoice

def fix_invoice_50():
    """Fix invoice #50 status"""
    try:
        # Get invoice 50
        invoice = Invoice.objects.get(id=50)
        print(f'Before fix:')
        print(f'  Invoice #{invoice.id} - {invoice.invoice_number}')
        print(f'  Status: {invoice.status}')
        print(f'  Total: ${invoice.total}')
        print(f'  Amount Paid: ${invoice.amount_paid}')
        print(f'  Balance Due: ${invoice.balance_due}')
        
        # Check refunds
        refunds = invoice.refunds.filter(status='processed')
        print(f'  Refunds: {refunds.count()}')
        for refund in refunds:
            print(f'    - Refund ${refund.amount}: {refund.reason}')
        
        print('\nRecalculating totals...')
        invoice.recalculate_totals()
        invoice.refresh_from_db()
        
        print(f'After fix:')
        print(f'  Status: {invoice.status}')
        print(f'  Amount Paid: ${invoice.amount_paid}')
        print(f'  Balance Due: ${invoice.balance_due}')
        
        if invoice.status == 'refunded':
            print('\n✅ SUCCESS: Invoice status is now "refunded"')
        else:
            print(f'\n❌ ISSUE: Invoice status is still "{invoice.status}"')
            
    except Invoice.DoesNotExist:
        print('❌ Invoice #50 not found')
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == '__main__':
    fix_invoice_50()
