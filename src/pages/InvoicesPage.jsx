import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api, formatKes, formatMonth } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { getMessage } from '../utils/formatters.js'
import { invoiceUsageLabel, latestReceivableBalance, summarizeInvoices } from '../utils/invoices.js'
import { notifyError } from '../utils/notifications.js'
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/ui/index.jsx'
import { PaymentDialog } from '../components/invoices/PaymentDialog.jsx'

export function InvoicesPage() {
  const user = useAuthStore((state) => state.user)
  const role = user.role
  const queryClient = useQueryClient()
  const invoicesQuery = useQuery({ queryKey: ['invoices', role], queryFn: role === 'ADMIN' ? api.getInvoices : api.getMyBills })
  const [paymentId, setPaymentId] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const payMutation = useMutation({
    mutationFn: ({ id, phoneNumber }) => api.payInvoice(id, { phoneNumber }),
    onSuccess: async (result) => {
      toast.success(`${result?.message || 'Payment prompt sent.'} Your invoice will update after payment is confirmed.`)
      setPaymentId(null)
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      await invoicesQuery.refetch()
    },
    onError: (error) => notifyError(getMessage(error)),
  })
  const cancelMutation = useMutation({
    mutationFn: (id) => api.cancelInvoice(id),
    onSuccess: () => { toast.success('Invoice cancelled.'); setCancelId(null); queryClient.invalidateQueries({ queryKey: ['invoices'] }) },
    onError: (error) => { setCancelId(null); notifyError(getMessage(error)) },
  })
  const invoices = Array.isArray(invoicesQuery.data) ? invoicesQuery.data : []
  const summary = summarizeInvoices(invoices)
  const balanceDue = role === 'CONSUMER' ? latestReceivableBalance(invoices) : summary.outstandingBalanceCents
  const title = role === 'ADMIN' ? 'Invoice administration' : 'Your bills'
  return <>
    <PageTitle eyebrow={role === 'ADMIN' ? 'BILLING / ADMINISTRATION' : 'BILLING / YOUR BILLS'} title={title} description={role === 'ADMIN' ? 'Review invoices available in your admin register.' : 'View your bills, usage, due dates, and payment status.'} />
    <div className="page-grid">
      <section className="bento-card span-3 invoice-main">
        <div className="card-heading"><div><div className="eyebrow">{role === 'ADMIN' ? 'INVOICE REGISTER' : 'YOUR BILLS'}</div><h3>{role === 'ADMIN' ? 'Invoices in register' : 'Bill history'}</h3></div><button className="icon-button" aria-label="Refresh invoices" onClick={() => invoicesQuery.refetch()}><RefreshCw size={16} /></button></div>
        {invoicesQuery.isLoading ? <LoadingState label="Loading invoices" /> : invoicesQuery.error ? <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} /> : !invoices.length ? <EmptyState title="No invoices found" description={role === 'ADMIN' ? 'Invoices will appear when readings are processed.' : 'Your invoices will appear here once they have been generated.'} /> :
          <div className="table-scroll"><table><thead><tr>{role === 'ADMIN' && <th>Customer</th>}<th>Billing period</th>{role === 'CONSUMER' && <th>Usage</th>}<th>Due date</th><th>Current bill</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}>
            {role === 'ADMIN' && <td><b>{invoice.customer?.firstName ? `${invoice.customer.firstName} ${invoice.customer.lastName || ''}` : 'Customer'}</b><small className="table-subtext">{invoice.customer?.accountNumber || '—'}</small></td>}
            <td><b>{formatMonth(invoice.billingMonth)}</b><small className="table-subtext">{String(invoice.id).slice(0, 8)}</small></td>
            {role === 'CONSUMER' && <td>{invoiceUsageLabel(invoice.consumptionUnits)}</td>}
            <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-KE') : '—'}</td>
            <td>{formatKes(invoice.currentBillCents)}</td><td className="money-cell">{formatKes(invoice.closingReceivableCents)}</td><td><StatusBadge status={invoice.status} /></td>
            <td>{role === 'CONSUMER' && invoice.status === 'UNPAID' ? <button className="button button-small button-primary" disabled={payMutation.isPending} onClick={() => setPaymentId(invoice.id)}>Pay now</button> :
              role === 'ADMIN' && !['PAID', 'CANCELLED'].includes(invoice.status) ? <button className="button button-small button-danger" onClick={() => setCancelId(invoice.id)}>Cancel</button> : <span className="muted-cell">—</span>}</td>
          </tr>)}</tbody></table></div>}
        {payMutation.error && <ErrorState error={payMutation.error} />}
      </section>
      <aside className="bento-card span-1 invoice-summary">
        <div className="eyebrow">{role === 'ADMIN' ? 'ADMIN INVOICE REGISTER' : 'YOUR BILL SUMMARY'}</div><h3>{role === 'ADMIN' ? 'Invoice register' : 'Balance due'}</h3>
        <strong className="summary-amount">{formatKes(balanceDue)}</strong><span className="summary-label">{role === 'ADMIN' ? 'Outstanding balance in this register' : 'Outstanding balance carried forward on your latest bill'}</span>
        <div className="summary-divider" />
        <div className="summary-row"><span>{role === 'ADMIN' ? 'Invoices in register' : 'Your invoices'}</span><b>{invoicesQuery.isLoading ? '—' : summary.invoiceCount}</b></div>
        <div className="summary-row"><span>Payment pending</span><b>{invoicesQuery.isLoading ? '—' : summary.pendingCount}</b></div>
        <div className="summary-row"><span>On admin hold</span><b>{invoicesQuery.isLoading ? '—' : summary.adminHoldCount}</b></div>
        {role === 'CONSUMER' && <div className="notice notice-info"><Clock3 size={16} /><div><strong>Payment confirmation</strong><p>A sent prompt is not proof of payment. Your invoice updates after the payment is confirmed.</p></div></div>}
      </aside>
    </div>
    {paymentId && invoices.find((invoice) => invoice.id === paymentId) && <PaymentDialog
      key={paymentId}
      invoice={invoices.find((invoice) => invoice.id === paymentId)}
      initialPhoneNumber={user.phoneNumber || ''}
      busy={payMutation.isPending}
      onClose={() => setPaymentId(null)}
      onSubmit={(phoneNumber) => payMutation.mutate({ id: paymentId, phoneNumber })}
    />}
    {cancelId && <ConfirmDialog title="Cancel this invoice?" description="This action cannot be undone. Please verify the invoice before confirming." confirmLabel="Cancel invoice" danger busy={cancelMutation.isPending} onClose={() => setCancelId(null)} onConfirm={() => cancelMutation.mutate(cancelId)} />}
  </>
}
