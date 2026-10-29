import assert from 'node:assert/strict'
import test from 'node:test'
import { invoiceUsageLabel, latestReceivableBalance, summarizeInvoices } from './invoices.js'

test('invoice usage label displays the consumption returned with an invoice', () => {
  assert.equal(invoiceUsageLabel(1250), '1,250 units')
  assert.equal(invoiceUsageLabel(null), '—')
  assert.equal(invoiceUsageLabel(undefined), '—')
})

test('invoice summary derives counts and balance only from the provided invoice list', () => {
  const summary = summarizeInvoices([
    { status: 'UNPAID', closingReceivableCents: 12500 },
    { status: 'PENDING_PAYMENT', closingReceivableCents: 5000 },
    { status: 'ADMIN_HOLD', closingReceivableCents: 9000 },
    { status: 'PAID', closingReceivableCents: 0 },
    { status: 'CANCELLED', closingReceivableCents: 3000 },
  ])

  assert.deepEqual(summary, {
    invoiceCount: 5,
    openCount: 3,
    attentionCount: 2,
    outstandingBalanceCents: 17500,
    pendingCount: 1,
    adminHoldCount: 1,
    paidCount: 1,
  })
})

test('invoice summary supports an empty authorized invoice list', () => {
  assert.deepEqual(summarizeInvoices([]), {
    invoiceCount: 0,
    openCount: 0,
    attentionCount: 0,
    outstandingBalanceCents: 0,
    pendingCount: 0,
    adminHoldCount: 0,
    paidCount: 0,
  })
})

test('consumer balance uses the latest cumulative receivable instead of adding carried balances', () => {
  const invoices = [
    { billingMonth: '2026-02', closingReceivableCents: 21000 },
    { billingMonth: '2026-01', closingReceivableCents: 12500 },
  ]

  assert.equal(latestReceivableBalance(invoices), 21000)
  assert.equal(latestReceivableBalance([
    { billingMonth: '2026-03', closingReceivableCents: 8000 },
    ...invoices,
  ]), 8000)
  assert.equal(latestReceivableBalance([]), 0)
})
