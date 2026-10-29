const OPEN_INVOICE_STATUSES = new Set(['UNPAID', 'PENDING_PAYMENT', 'ADMIN_HOLD'])
const OUTSTANDING_INVOICE_STATUSES = new Set(['UNPAID', 'PENDING_PAYMENT'])

export function invoiceUsageLabel(consumptionUnits) {
  if (consumptionUnits == null || !Number.isFinite(Number(consumptionUnits))) return '—'
  return `${Number(consumptionUnits).toLocaleString('en-KE')} units`
}

export function latestReceivableBalance(invoices) {
  return Number(invoices[0]?.closingReceivableCents) || 0
}

export function summarizeInvoices(invoices) {
  return invoices.reduce((summary, invoice) => {
    if (OPEN_INVOICE_STATUSES.has(invoice.status)) summary.openCount += 1
    if (OUTSTANDING_INVOICE_STATUSES.has(invoice.status)) {
      summary.outstandingBalanceCents += Number(invoice.closingReceivableCents) || 0
    }
    if (invoice.status === 'UNPAID' || invoice.status === 'ADMIN_HOLD') summary.attentionCount += 1
    if (invoice.status === 'PENDING_PAYMENT') summary.pendingCount += 1
    if (invoice.status === 'ADMIN_HOLD') summary.adminHoldCount += 1
    if (invoice.status === 'PAID') summary.paidCount += 1
    summary.invoiceCount += 1
    return summary
  }, {
    invoiceCount: 0,
    openCount: 0,
    attentionCount: 0,
    outstandingBalanceCents: 0,
    pendingCount: 0,
    adminHoldCount: 0,
    paidCount: 0,
  })
}
