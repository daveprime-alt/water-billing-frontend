import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, Banknote, BookOpenCheck, Clock3, Droplets, FileText, Gauge, LoaderCircle, Plus, RefreshCw, ShieldCheck, Users, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { api, formatKes, formatMonth } from '../../services/api.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useReadingsQuery } from '../../hooks/useReadingsQuery.js'
import { readingsForDisplay } from '../../utils/readings.js'
import { getMessage } from '../../utils/formatters.js'
import { EmptyState, ErrorState, LoadingState, PageTitle, StatusBadge } from '../ui/index.jsx'
import { PaymentDialog } from '../invoices/PaymentDialog.jsx'

export function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const role = user.role
  const queryClient = useQueryClient()
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  })
  const invoicesQuery = useQuery({
    queryKey: ['invoices', role],
    queryFn: role === 'ADMIN' ? api.getInvoices : api.getMyBills,
    enabled: role !== 'READER',
  })
  const readingsQuery = useReadingsQuery(role, user.id)
  const payMutation = useMutation({
    mutationFn: ({ invoiceId, phoneNumber }) => api.payInvoice(invoiceId, { phoneNumber }),
    onSuccess: async (result) => {
      toast.success(`${result?.message || 'Payment prompt sent.'} Payment remains pending until backend reconciliation.`)
      setPaymentInvoice(null)
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error) => toast.error(getMessage(error)),
  })
  const invoices = Array.isArray(invoicesQuery.data) ? invoicesQuery.data : []
  const readings = readingsForDisplay(readingsQuery.data, role, readingsQuery.isFetching, readingsQuery.isError)
  const latestInvoice = invoices[0] ?? null
  const invoiceAmountDue = latestInvoice?.closingReceivableCents ?? latestInvoice?.currentBillCents
  const consumptionUnits = latestInvoice?.consumptionUnits
  const hasConsumptionUnits = consumptionUnits !== null && consumptionUnits !== undefined && Number.isFinite(Number(consumptionUnits))
  const roleColorName = role === 'ADMIN' ? 'green' : role === 'READER' ? 'red' : 'blue'
  const cycle = formatMonth(new Date())
  const title = role === 'ADMIN' ? 'System overview' : role === 'READER' ? 'Field overview' : 'Your monthly bill'
  const description = role === 'ADMIN' ? 'A live view of billing activity across your utility.' : role === 'READER' ? 'Your current field activity and meter reading log.' : 'See your latest water charge, usage, and payment prompt.'

  return (
    <div className={`dashboard-page ${roleColorName}`}>
      <PageTitle eyebrow={role === 'CONSUMER' ? 'BILLING / MONTHLY SUMMARY' : 'DASHBOARD / OVERVIEW'} title={title} description={description}
        action={<button className="button button-secondary" onClick={() => window.location.reload()}><RefreshCw size={15} /> Refresh data</button>} />
      <div className="bento-grid">
        {role === 'CONSUMER' && <section className="bento-card span-4 monthly-bill-card" aria-labelledby="monthly-bill-title">
          <div className="monthly-bill-heading">
            <div><div className="eyebrow">LATEST INVOICE</div><h2 id="monthly-bill-title">{latestInvoice ? formatMonth(latestInvoice.billingMonth) : 'This month'}</h2></div>
            {latestInvoice && <StatusBadge status={latestInvoice.status} />}
          </div>
          {invoicesQuery.isLoading ? <LoadingState label="Loading your monthly invoice" /> : invoicesQuery.error ? <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} /> : !latestInvoice ? (
            <EmptyState title="No invoice yet" description="Your monthly invoice will appear here after a meter reading is processed." />
          ) : (
            <div className="monthly-bill-content">
              <div className="monthly-bill-amount">
                <span>Amount to pay</span>
                <strong>{formatKes(invoiceAmountDue)}</strong>
                <small>Invoice charge: {formatKes(latestInvoice.currentBillCents)}</small>
              </div>
              <div className="monthly-bill-usage">
                <span>Water consumed · {formatMonth(latestInvoice.billingMonth)}</span>
                <strong>{hasConsumptionUnits ? `${Number(consumptionUnits).toLocaleString('en-KE')} units` : 'Not available'}</strong>
                {!hasConsumptionUnits
                  ? <small>Usage details will appear when provided with your invoice.</small>
                  : <small>Metered consumption for this billing period</small>}
              </div>
              <div className="monthly-bill-action">
                {latestInvoice.status === 'UNPAID'
                  ? <button className="button button-primary button-full" disabled={payMutation.isPending} onClick={() => setPaymentInvoice(latestInvoice)}>{payMutation.isPending ? 'Sending prompt…' : 'Pay now'}</button>
                  : latestInvoice.status === 'PENDING_PAYMENT'
                    ? <span className="monthly-bill-message">Payment prompt sent. Awaiting confirmation.</span>
                    : latestInvoice.status === 'ADMIN_HOLD'
                      ? <span className="monthly-bill-message">This invoice is under review and cannot be paid yet.</span>
                      : <span className="monthly-bill-message">No payment is currently required.</span>}
                <small>We’ll ask which phone number should receive the M-Pesa prompt.</small>
              </div>
            </div>
          )}
        </section>}

        {role !== 'CONSUMER' && <section className="bento-card welcome-card span-3" aria-labelledby="welcome-title">
          <div className="welcome-top"><span className="welcome-icon"><Droplets size={18} /></span><span className="live-chip">UTILITY PORTAL</span></div>
          <div className="welcome-body">
            <div><h2 id="welcome-title">Good to see you, {profile?.firstName || user.firstName || 'there'}.</h2><p>{description}</p></div>
            <div className="welcome-meta">
              <div><span>Current cycle</span><b>{cycle}</b></div>
              <div><span>Service location</span><b>{profile?.location || user.location || 'Not set'}</b></div>
              <div><span>Account no.</span><b>{profile?.accountNumber || user.accountNumber || '—'}</b></div>
            </div>
          </div>
          {profileLoading && <div className="inline-note"><LoaderCircle size={13} className="spin" /> Syncing profile</div>}
          {profileError && <div className="inline-error">{getMessage(profileError)} <button onClick={() => refetchProfile()}>Retry</button></div>}
        </section>}

        {role !== 'CONSUMER' && <section className="bento-card span-1 metric-card" aria-label={role === 'ADMIN' ? 'Active invoices' : 'Current month readings'}>
          <div className="metric-head"><span>{role === 'ADMIN' ? 'ACTIVE INVOICES' : 'THIS MONTH'}</span><span className="metric-icon"><Banknote size={17} /></span></div>
          {invoicesQuery.isLoading || readingsQuery.isLoading || (role === 'READER' && readingsQuery.isFetching) ? <div className="metric-skeleton" /> :
            <><strong className="metric-value">{role === 'ADMIN' ? invoices.filter((item) => !['PAID', 'CANCELLED'].includes(item.status)).length : readings.length}</strong><span className="metric-foot">{role === 'ADMIN' ? 'Invoices awaiting resolution' : 'Readings recorded'}</span></>}
          {(role === 'ADMIN' ? invoicesQuery.error : readingsQuery.error) && <span className="metric-error">Could not fetch live data</span>}
        </section>}

        {role !== 'CONSUMER' && <section className="bento-card span-2 cycle-card">
          <div className="card-heading"><div><div className="eyebrow">CYCLE STATUS</div><h3>{role === 'CONSUMER' ? 'Billing snapshot' : 'Operations snapshot'}</h3></div><span className="icon-tile"><Clock3 size={17} /></span></div>
          {role === 'CONSUMER' ? (
            invoicesQuery.isLoading ? <LoadingState label="Loading invoices" /> : invoicesQuery.error ? <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} /> :
              <div className="snapshot-row"><div><span>Latest invoice</span><b>{invoices[0] ? formatMonth(invoices[0].billingMonth) : 'No invoices yet'}</b></div><div><span>Payment state</span><b>{invoices[0] ? <StatusBadge status={invoices[0].status} /> : '—'}</b></div><Link to="/invoices" className="text-link">View invoices <ArrowRight size={14} /></Link></div>
          ) : role === 'ADMIN' ? (
            invoicesQuery.isLoading ? <LoadingState label="Loading invoices" /> : invoicesQuery.error ? <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} /> :
              <div className="snapshot-row"><div><span>Needs attention</span><b>{invoices.filter((item) => ['UNPAID', 'ADMIN_HOLD'].includes(item.status)).length} invoices</b></div><div><span>Reconciled</span><b>{invoices.filter((item) => item.status === 'PAID').length} paid</b></div><Link to="/invoices" className="text-link">Review billing <ArrowRight size={14} /></Link></div>
          ) : (
            readingsQuery.isLoading || (role === 'READER' && readingsQuery.isFetching) ? <LoadingState label="Loading readings" /> : readingsQuery.error ? <ErrorState error={readingsQuery.error} onRetry={() => readingsQuery.refetch()} /> :
              <div className="snapshot-row"><div><span>Current month log</span><b>{readings.length} readings</b></div><div><span>Field access</span><b>Current cycle</b></div><Link to="/readings" className="text-link">Open reading log <ArrowRight size={14} /></Link></div>
          )}
        </section>}

        <section className="bento-card span-2 quick-card">
          <div className="card-heading"><div><div className="eyebrow">QUICK ACCESS</div><h3>Common actions</h3></div><span className="icon-tile"><ArrowUpRight size={17} /></span></div>
          <div className="quick-links">
            {role === 'CONSUMER' && <><Link to="/invoices"><span className="quick-link-icon"><FileText size={16} /></span><span><b>View & pay invoices</b><small>Track balance and payment status</small></span><ArrowRight size={16} /></Link><Link to="/profile"><span className="quick-link-icon"><UserRound size={16} /></span><span><b>Update profile</b><small>Keep your contact details current</small></span><ArrowRight size={16} /></Link></>}
            {role === 'READER' && <><Link to="/readings?action=record"><span className="quick-link-icon"><Plus size={16} /></span><span><b>Record a meter reading</b><small>Customer ID is required by the API</small></span><ArrowRight size={16} /></Link><Link to="/readings"><span className="quick-link-icon"><BookOpenCheck size={16} /></span><span><b>Review reading log</b><small>View this month’s submissions</small></span><ArrowRight size={16} /></Link></>}
            {role === 'ADMIN' && <><Link to="/accounts"><span className="quick-link-icon"><Users size={16} /></span><span><b>Create or import accounts</b><small>Provision consumer and reader access</small></span><ArrowRight size={16} /></Link><Link to="/readings"><span className="quick-link-icon"><Gauge size={16} /></span><span><b>Manage meter readings</b><small>Review field submissions</small></span><ArrowRight size={16} /></Link></>}
          </div>
        </section>

        <section className="bento-card span-2 table-card">
          <div className="card-heading table-heading"><div><div className="eyebrow">{role === 'CONSUMER' ? 'BILLING HISTORY' : role === 'READER' ? 'FIELD LOG' : 'RECENT ACTIVITY'}</div><h3>{role === 'CONSUMER' ? 'Recent invoices' : role === 'READER' ? 'Recent readings' : 'Recent invoices'}</h3></div><Link to={role === 'READER' ? '/readings' : '/invoices'} className="text-link">View all <ArrowRight size={14} /></Link></div>
          {role === 'READER' ? <ReadingTable readings={readings.slice(0, 5)} loading={readingsQuery.isLoading} error={readingsQuery.error} retry={() => readingsQuery.refetch()} /> :
            <InvoiceTable invoices={invoices.slice(0, 5)} loading={invoicesQuery.isLoading} error={invoicesQuery.error} retry={() => invoicesQuery.refetch()} />}
        </section>

        <section className="bento-card span-2 note-card">
          <div className="notice-mark"><ShieldCheck size={19} /></div><div><div className="eyebrow">SECURE ACCOUNT</div><h3>Your account stays protected</h3><p>Never share your password or payment confirmation code. A payment prompt is not confirmation of payment; your invoice updates once the utility reconciles the transaction.</p><Link to="/profile" className="text-link">Review account security <ArrowRight size={14} /></Link></div>
        </section>
      </div>
      {paymentInvoice && <PaymentDialog
        key={paymentInvoice.id}
        invoice={paymentInvoice}
        initialPhoneNumber={profile?.phoneNumber || user.phoneNumber || ''}
        busy={payMutation.isPending}
        onClose={() => setPaymentInvoice(null)}
        onSubmit={(phoneNumber) => payMutation.mutate({ invoiceId: paymentInvoice.id, phoneNumber })}
      />}
    </div>
  )
}

export function InvoiceTable({ invoices, loading, error, retry }) {
  if (loading) return <LoadingState label="Loading invoice history" />
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (!invoices.length) return <EmptyState title="No invoices yet" description="Invoices created for your account will appear here." />
  return <div className="table-scroll"><table><thead><tr><th>Billing period</th><th>Due date</th><th>Amount due</th><th>Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><b>{formatMonth(invoice.billingMonth)}</b><small className="table-subtext">Invoice {String(invoice.id).slice(0, 8)}</small></td><td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td><td className="money-cell">{formatKes(invoice.closingReceivableCents ?? invoice.currentBillCents)}</td><td><StatusBadge status={invoice.status} /></td></tr>)}</tbody></table></div>
}

export function ReadingTable({ readings, loading, error, retry }) {
  if (loading) return <LoadingState label="Loading reading history" />
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (!readings.length) return <EmptyState icon={Gauge} title="No readings this month" description="Meter readings you record will appear in this field log." />
  return <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Reading</th><th>Recorded</th><th>Review</th></tr></thead><tbody>{readings.map((reading) => <tr key={reading.id}><td><b>{reading.customer?.firstName ? `${reading.customer.firstName} ${reading.customer.lastName || ''}` : reading.customerId || 'Customer'}</b><small className="table-subtext">{reading.customer?.accountNumber || reading.customerId || '—'}</small></td><td className="money-cell">{reading.currentReading?.toLocaleString('en-KE') ?? '—'} units</td><td>{reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '—'}</td><td>{reading.usageReview?.onHold ? <span className="review-flag">Review</span> : <span className="review-clear">Clear</span>}</td></tr>)}</tbody></table></div>
}
