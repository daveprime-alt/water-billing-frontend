import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api, formatKes, formatMonth } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { getMessage } from '../utils/formatters.js'
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
      toast.success(`${result?.message || 'Payment prompt sent.'} Payment remains pending until backend reconciliation.`)
      setPaymentId(null)
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      await invoicesQuery.refetch()
    },
    onError: (error) => toast.error(getMessage(error)),
  })
  const cancelMutation = useMutation({
    mutationFn: (id) => api.cancelInvoice(id),
    onSuccess: () => { toast.success('Invoice cancelled.'); setCancelId(null); queryClient.invalidateQueries({ queryKey: ['invoices'] }) },
    onError: (error) => { setCancelId(null); toast.error(getMessage(error)) },
  })
  const invoices = Array.isArray(invoicesQuery.data) ? invoicesQuery.data : []
  const total = invoices.filter((invoice) => ['UNPAID', 'PENDING_PAYMENT'].includes(invoice.status)).reduce((sum, invoice) => sum + (Number(invoice.closingReceivableCents) || 0), 0)
  const title = role === 'ADMIN' ? 'Invoice administration' : 'Your invoices'
  return <>
    <PageTitle eyebrow={role === 'ADMIN' ? 'BILLING / ADMINISTRATION' : 'BILLING / MY ACCOUNT'} title={title} description={role === 'ADMIN' ? 'Review invoice status across all customer accounts.' : 'Review your bill history and manage outstanding payments.'} />
    <div className="page-grid">
      <section className="bento-card span-3 invoice-main">
        <div className="card-heading"><div><div className="eyebrow">INVOICE REGISTER</div><h3>{role === 'ADMIN' ? 'All invoices' : 'Billing history'}</h3></div><button className="icon-button" aria-label="Refresh invoices" onClick={() => invoicesQuery.refetch()}><RefreshCw size={16} /></button></div>
        {invoicesQuery.isLoading ? <LoadingState label="Loading invoices" /> : invoicesQuery.error ? <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} /> : !invoices.length ? <EmptyState title="No invoices found" description={role === 'ADMIN' ? 'Invoices will appear when readings are processed.' : 'Your invoices will appear here once they have been generated.'} /> :
          <div className="table-scroll"><table><thead><tr>{role === 'ADMIN' && <th>Customer</th>}<th>Billing period</th><th>Due date</th><th>Current bill</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}>
            {role === 'ADMIN' && <td><b>{invoice.customer?.firstName ? `${invoice.customer.firstName} ${invoice.customer.lastName || ''}` : 'Customer'}</b><small className="table-subtext">{invoice.customer?.accountNumber || '—'}</small></td>}
            <td><b>{formatMonth(invoice.billingMonth)}</b><small className="table-subtext">{String(invoice.id).slice(0, 8)}</small></td>
            <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-KE') : '—'}</td>
            <td>{formatKes(invoice.currentBillCents)}</td><td className="money-cell">{formatKes(invoice.closingReceivableCents)}</td><td><StatusBadge status={invoice.status} /></td>
            <td>{role === 'CONSUMER' && invoice.status === 'UNPAID' ? <button className="button button-small button-primary" disabled={payMutation.isPending} onClick={() => setPaymentId(invoice.id)}>Pay now</button> :
              role === 'ADMIN' && !['PAID', 'CANCELLED'].includes(invoice.status) ? <button className="button button-small button-danger" onClick={() => setCancelId(invoice.id)}>Cancel</button> : <span className="muted-cell">—</span>}</td>
          </tr>)}</tbody></table></div>}
        {payMutation.error && <ErrorState error={payMutation.error} />}
      </section>
      <aside className="bento-card span-1 invoice-summary">
        <div className="eyebrow">{role === 'ADMIN' ? 'REGISTER SUMMARY' : 'ACCOUNT SUMMARY'}</div><h3>{role === 'ADMIN' ? 'All accounts' : 'Balance due'}</h3>
        <strong className="summary-amount">{formatKes(total)}</strong><span className="summary-label">Outstanding invoice balance</span>
        <div className="summary-divider" />
        <div className="summary-row"><span>Total invoices</span><b>{invoicesQuery.isLoading ? '—' : invoices.length}</b></div>
        <div className="summary-row"><span>Payment pending</span><b>{invoices.filter((item) => item.status === 'PENDING_PAYMENT').length}</b></div>
        <div className="summary-row"><span>On admin hold</span><b>{invoices.filter((item) => item.status === 'ADMIN_HOLD').length}</b></div>
        {role === 'CONSUMER' && <div className="notice notice-info"><Clock3 size={16} /><div><strong>Payment confirmation</strong><p>A sent prompt is not proof of payment. Your status changes after backend reconciliation.</p></div></div>}
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
    {cancelId && <ConfirmDialog title="Cancel this invoice?" description="This action is processed by the utility API. Please verify the invoice before confirming." confirmLabel="Cancel invoice" danger busy={cancelMutation.isPending} onClose={() => setCancelId(null)} onConfirm={() => cancelMutation.mutate(cancelId)} />}
  </>
}
