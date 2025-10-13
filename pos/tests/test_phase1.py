from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone

from pos.models import Invoice, InvoiceItem, PaymentMethod
from guests.models import Guest
from services.models import Service


class Phase1PaymentFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester', password='test')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.guest = Guest.objects.create(first_name='Test', last_name='Guest', email='test@example.com')

        # Ensure a basic service exists for line item convenience
        self.service = Service.objects.create(name='Test Service', duration_minutes=60, price=Decimal('100.00'))

        # Payment method
        self.cash = PaymentMethod.objects.create(name='Cash', code='cash', is_active=True)

    def create_invoice_with_total(self, total: Decimal = Decimal('100.00')) -> Invoice:
        invoice = Invoice.objects.create(guest=self.guest)
        # Add one item priced at total (tax/discount 0 by default)
        InvoiceItem.objects.create(
            invoice=invoice,
            service=self.service,
            product_name=self.service.name,
            quantity=1,
            unit_price=total,
            tax_rate=Decimal('0.00'),
        )
        invoice.recalculate_totals()
        return invoice

    def test_idempotent_payment_submission(self):
        invoice = self.create_invoice_with_total(Decimal('100.00'))
        idem = 'test-idem-001'
        payload = {
            'amount': '100.00',
            'payment_method': self.cash.id,
            'payment_type': 'full',
            'idempotency_key': idem,
        }

        r1 = self.client.post(f'/api/invoices/{invoice.id}/process-payment/', payload, format='json')
        self.assertEqual(r1.status_code, 200)

        r2 = self.client.post(f'/api/invoices/{invoice.id}/process-payment/', payload, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.data.get('success'))
        self.assertTrue(r2.data.get('duplicate', False))

        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal('100.00'))
        self.assertEqual(invoice.balance_due, Decimal('0.00'))

    def test_overpay_prevention(self):
        invoice = self.create_invoice_with_total(Decimal('50.00'))
        payload = {
            'amount': '60.00',
            'payment_method': self.cash.id,
            'payment_type': 'full',
        }
        r = self.client.post(f'/api/invoices/{invoice.id}/process-payment/', payload, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('cannot exceed', r.data.get('error', '').lower())

    def test_targeted_partial_refund(self):
        invoice = self.create_invoice_with_total(Decimal('100.00'))
        pay = self.client.post(
            f'/api/invoices/{invoice.id}/process-payment/',
            {
                'amount': '100.00',
                'payment_method': self.cash.id,
                'payment_type': 'full',
            },
            format='json',
        )
        self.assertEqual(pay.status_code, 200)
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal('100.00'))

        # Fetch payment id via history
        ph = self.client.get(f'/api/invoices/{invoice.id}/payment-history/')
        self.assertEqual(ph.status_code, 200)
        payment_id = ph.data['payments'][0]['id']

        # Targeted refund of 30
        ref = self.client.post(
            f'/api/invoices/{invoice.id}/refund/',
            {
                'amount': '30.00',
                'reason': 'Partial refund',
                'payment_id': payment_id,
            },
            format='json',
        )
        self.assertEqual(ref.status_code, 200)
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal('70.00'))
        self.assertEqual(invoice.status, 'partial')


