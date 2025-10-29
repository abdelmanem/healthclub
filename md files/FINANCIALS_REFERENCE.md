## Financial System Reference (Invoices, Payments, Deposits, Refunds, Discounts)

This document explains the end-to-end financial flows in the application, covering data models, lifecycles, API endpoints, and what gets updated when. It reconciles backend behavior with frontend expectations so engineers can reason about the system consistently.

### Key Data Models (pos.models)

- Invoice
  - Fields: `subtotal`, `tax`, `service_charge`, `discount`, `total`, `amount_paid`, `balance_due`, `status`, `paid_date`, `version`, `guest`, `reservation`
  - Status lifecycle: `draft → issued → partial → paid → overdue → cancelled → refunded`
  - Totals engine: `Invoice.recalculate_totals()` recomputes all amounts and updates `status` and `version` inside a DB transaction with row locks.
  - Relationships:
    - `items` (InvoiceItem): contributes to `subtotal` (and per-item tax)
    - `payments` (Payment): positive inflows; reduces `balance_due`
    - `refunds` (Refund): outflows; deducted from `amount_paid`

- InvoiceItem
  - Line items linked to `invoice` and optional `service`. Saving/deleting items triggers `invoice.recalculate_totals()`.
  - Line-level helpers: `line_total`, `get_tax_amount`, `get_total_with_tax`.

- Payment
  - Positive amounts only (refunds are separate in `Refund`).
  - Fields: `method` (cash/card/wallet/.../deposit), `payment_method` (FK), `payment_type` (`regular | deposit_application | manual`), `amount`, `status`, `idempotency_key`.
  - Invariants:
    - Amount must be positive.
    - If status is `completed` when creating, amount cannot exceed the invoice’s current `balance_due`.
  - On save: Uses a DB transaction and locks the invoice row, then calls `invoice.recalculate_totals()` and updates guest loyalty (points ≈ int(amount), total_spent += amount), if guest fields exist.

- Refund
  - Positive amounts only; separate table from `Payment`.
  - Optionally links to a specific `original_payment` (for partial refunds).
  - Workflow: `pending → approved → processed`.
  - Invariants:
    - Sum of processed refunds for the invoice cannot exceed `invoice.amount_paid`.
  - On `processed` save: locks invoice, recalculates totals, and updates guest loyalty (deduct points and spending by the refund amount).

- Deposit (Prepayment)
  - Guest-level credit collected before service; may reference a `reservation` but is not tied to an invoice until applied.
  - Fields: `amount`, `amount_applied`, `status` (`pending | collected | partially_applied | fully_applied | refunded | expired`), `payment_method`, `collected_at`.
  - `remaining_amount = amount - amount_applied`.
  - `can_be_applied()` if status is one of pending/collected/partially_applied, has positive remaining, and not expired.
  - `apply_to_invoice(invoice, amount=None)`:
    - Locks both deposit and invoice rows.
    - Defaults `amount` to the deposit’s `remaining_amount`; caps to `invoice.balance_due` if needed.
    - Creates a `Payment` on the invoice with `method='deposit'` and `payment_type='deposit_application'` for the applied amount.
    - Increments `deposit.amount_applied`, updates `deposit.status` to `fully_applied` or `partially_applied`.
    - Returns the created `Payment`.

### Totals and Status Logic (Invoice.recalculate_totals)

Inside a transaction with a row lock on the invoice:
1) Sum all `InvoiceItem` line totals → `subtotal`.
2) Compute `service_charge` based on `PosConfig.service_charge_rate`.
3) Compute tax as item-level tax plus VAT on `(subtotal + service_charge)` using `PosConfig.vat_rate`.
4) Compute `total = subtotal + service_charge + tax - discount`.
5) Compute `amount_paid` as sum of completed `Payment` amounts minus sum of processed `Refund` amounts.
6) Compute `balance_due = total - amount_paid`.
7) Update `status`:
   - If any processed refunds exist: `refunded`.
   - Else if `balance_due <= 0` and `total > 0`: `paid` and set `paid_date`.
   - Else if `amount_paid > 0` and `balance_due > 0`: `partial`.
   - Else if `amount_paid == 0`: `issued` or `overdue` depending on `due_date` (unless in `draft/cancelled/refunded`).
8) Bump `version` for optimistic locking.

### API Endpoints (pos.views)

Invoice-centric actions:
- `POST /api/invoices/{id}/process_payment/` → Validates with `ProcessPaymentSerializer`, creates `Payment`, recalculates invoice, returns summary and `version`.
- `POST /api/invoices/{id}/refund/` → Validates with `RefundSerializer`, creates `Refund` and when `processed`, recalculates invoice.
- `POST /api/invoices/{id}/apply_discount/` → Directly adjusts `invoice.discount`, recalculates totals, and bumps `version`.
- `GET /api/invoices/{id}/payment_history/` and `GET /api/invoices/{id}/refund-history/` → Read-only histories.
- `GET /api/invoices/{id}/available_deposits/` → Lists guest-level deposits that still have `remaining_amount > 0` and are eligible (pending/collected/partially_applied, not expired). This is why deposits may appear “for multiple invoices”: they are guest credits until fully consumed.
- `POST /api/invoices/{id}/apply_deposit/` and alias `POST /api/invoices/{id}/apply-deposit/` → Applies part/all of a deposit to the invoice. Body: `{ "deposit_id": number, "amount"?: decimal }`. Creates a `Payment` of type `deposit_application`, updates deposit, and returns amounts.

Payments read-only endpoints:
- `GET /api/payments/` and analytics subroutes (summary, daily_report...). Payments are created through invoice actions.

### Frontend Integration Notes

- Available deposits in the UI are guest-level; the same deposit can be displayed across different invoices for the guest until its `remaining_amount` is zero. The system prevents double-spend via row locks and by updating `remaining_amount` atomically.
- Applying a deposit creates a `Payment` with:
  - `method = 'deposit'`
  - `payment_type = 'deposit_application'`
  - `status = 'completed'`
  - `reference = 'Deposit #<id>'`
  This reduces `balance_due` on the invoice and updates the deposit’s status.
- Regular payments are created by `process_payment` and validated to not exceed `balance_due`.
- Refunds are created separately in `Refund`; they reduce the effective paid amount and can move an invoice from `paid` to `partial`.

### Common Questions and Clarifications

- Why do partially-applied deposits appear for other invoices?
  - Deposits are guest-level credits. A deposit with non-zero `remaining_amount` remains available to all invoices for the same guest until fully used. No duplication occurs because every application updates `amount_applied` and `remaining_amount` atomically.

- Can we restrict deposits to the same reservation?
  - Current behavior is guest-level. You can change the list in `available_deposits` to filter by `reservation=invoice.reservation` if a business rule demands it (or make it optional via query param).

- What prevents double-charging or race conditions?
  - All financial mutations (payments, refunds, deposit applications) take place inside DB transactions with `select_for_update()` row locks on affected invoices (and deposits). This ensures consistent totals and prevents overspending across concurrent requests.

- How does optimistic locking work?
  - Certain endpoints (e.g., `process_payment`) accept a client-sent `version`. If the invoice’s `version` changed since the UI loaded it, the endpoint can reject with 409 so the UI refreshes and replays with current data.

### Tables/Fields Updated per Operation

- Create/Update InvoiceItem
  - Writes: `pos_invoiceitem` row
  - Triggers: `Invoice.recalculate_totals()` → updates `pos_invoice` financial fields, `status`, `version`

- Process Payment (regular or manual)
  - Writes: `pos_payment` row (positive amount)
  - Triggers: recalculation of `pos_invoice` totals (including status), guest loyalty increments

- Apply Deposit to Invoice
  - Writes: `pos_payment` row (method `deposit`, type `deposit_application`)
  - Writes: `pos_deposit.amount_applied`, `pos_deposit.status` (to `partially_applied` or `fully_applied`)
  - Triggers: invoice totals recalculation (amount_paid, balance_due, status)

- Process Refund
  - Writes: `pos_refund` row (positive amount)
  - On `processed`: triggers `pos_invoice` totals recalculation and guest loyalty deduction

- Apply Discount
  - Writes: `pos_invoice.discount`, `pos_invoice.total`, `pos_invoice.balance_due`, `pos_invoice.version`

### Endpoint Reference (frontend alignment)

- Invoices
  - `GET /api/invoices/` list, `GET /api/invoices/{id}/` retrieve
  - `POST /api/invoices/{id}/process_payment/`
  - `POST /api/invoices/{id}/apply_discount/`
  - `POST /api/invoices/{id}/refund/`
  - `POST /api/invoices/{id}/apply_deposit/` and `/apply-deposit/` (alias)
  - `GET /api/invoices/{id}/available_deposits/`
  - `GET /api/invoices/{id}/payment_history/`, `GET /api/invoices/{id}/refund-history/`

- Deposits (read list via invoice):
  - `GET /api/invoices/{id}/available_deposits/`

- Payments (read-only):
  - `GET /api/payments/`, `GET /api/payments/summary/`, `GET /api/payments/daily_report/`

### Business Rules Summary

- Payments: never negative; cannot exceed `balance_due` when marking completed at creation.
- Refunds: never negative; processed sum cannot exceed `amount_paid` for the invoice. Separate entity from payments.
- Deposits: guest-level credit until fully applied or refunded/expired. Applications create positive `Payment` rows on the target invoice.
- Discounts: directly adjust the invoice’s `discount`, which feeds the totals calculation.
- Concurrency: Use of transactions and row locks for financial invariants; `version` field supports optimistic concurrency.

### Suggested UI Text (to reduce confusion)

- For partially applied deposits, display: “Shared deposit — $<remaining_amount> remaining” and a tooltip: “Deposits are guest-level credits and can be applied across invoices until fully used.”

---

Authoritative Sources in Code
- Models: `pos/models.py` (Invoice, Payment, Refund, Deposit, InvoiceItem, PosConfig)
- Views: `pos/views.py` (InvoiceViewSet actions; PaymentViewSet read-only)
- Serializers: `pos/serializers.py` (shape and validation)
- Signals: `pos/signals.py` (permissions on invoice create)


