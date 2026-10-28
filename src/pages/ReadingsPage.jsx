import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { AlertCircle, Check, Gauge, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api, formatMonth } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { useReadingsQuery } from '../hooks/useReadingsQuery.js'
import { getMessage } from '../utils/formatters.js'
import { canEditReading, currentUtcBillingMonth, readingUpdateErrorMessage, readingsForDisplay } from '../utils/readings.js'
import { ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, Modal, PageTitle } from '../components/ui/index.jsx'
import { UserDirectorySearch } from '../components/accounts/UserDirectorySearch.jsx'

export function ReadingsPage() {
  const role = useAuthStore((state) => state.user.role)
  const userId = useAuthStore((state) => state.user.id)
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(new URLSearchParams(location.search).get('action') === 'record')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [consumerFilter, setConsumerFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const readingsQuery = useReadingsQuery(role, userId)
  const schema = z.object({ customerId: z.string().trim().min(1, 'Enter the customer ID'), currentReading: z.coerce.number().int('Enter a whole number').min(0, 'Reading cannot be below 0').max(99999, 'Reading cannot exceed 99,999') })
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) })
  const recordMutation = useMutation({
    mutationFn: (values) => api.createReading(values),
    onSuccess: (result) => {
      toast.success(result?.message || 'Reading recorded.')
      if (result?.usageReview?.onHold) toast.warning(`This invoice is held for admin review. Previous reading average: ${result.usageReview.averageUnits ?? 'not available'} units.`)
      reset(); setSelectedCustomer(null); setShowForm(false); queryClient.invalidateQueries({ queryKey: ['readings'] }); queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error) => toast.error(getMessage(error)),
  })
  const updateSchema = z.object({ currentReading: z.coerce.number().int('Enter a whole number').min(0).max(99999) })
  const { register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEdit, formState: { errors: editErrors } } = useForm({ resolver: zodResolver(updateSchema) })
  const updateMutation = useMutation({
    mutationFn: ({ id, currentReading }) => api.updateReading(id, { currentReading }),
    onSuccess: () => { toast.success('Reading corrected.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['readings'] }); queryClient.invalidateQueries({ queryKey: ['invoices'] }) },
    onError: (error) => toast.error(role === 'READER' ? readingUpdateErrorMessage(error) : getMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteReading,
    onSuccess: () => { toast.success('Reading deleted.'); setDeleting(null); queryClient.invalidateQueries({ queryKey: ['readings'] }) },
    onError: (error) => { setDeleting(null); toast.error(getMessage(error)) },
  })
  const readings = useMemo(() => readingsForDisplay(readingsQuery.data, role, readingsQuery.isFetching, readingsQuery.isError), [readingsQuery.data, readingsQuery.isError, readingsQuery.isFetching, role])
  const consumers = useMemo(() => {
    const byId = new Map()
    readings.forEach((reading) => {
      const id = reading.customer?.id || reading.customerId
      if (id && !byId.has(id)) byId.set(id, { ...reading.customer, id, accountNumber: reading.customer?.accountNumber || id })
    })
    return [...byId.values()].sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''} ${a.accountNumber || ''}`
      const nameB = `${b.firstName || ''} ${b.lastName || ''} ${b.accountNumber || ''}`
      return nameA.localeCompare(nameB)
    })
  }, [readings])
  const readingMonth = (reading) => {
    const value = reading.billingMonth || reading.billingPeriod || reading.createdAt
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 7) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  const months = useMemo(() => [...new Set(readings.map(readingMonth).filter(Boolean))].sort().reverse(), [readings])
  const filteredReadings = readings.filter((reading) => {
    const customerId = reading.customer?.id || reading.customerId
    return (!consumerFilter || customerId === consumerFilter) && (!monthFilter || readingMonth(reading) === monthFilter)
  })
  const selectedConsumer = consumers.find((consumer) => consumer.id === consumerFilter)
  const selectedConsumption = filteredReadings.reduce((total, reading) => total + (Number(reading.consumptionUnits) || 0), 0)
  const recordedMonthCount = new Set(filteredReadings.map(readingMonth).filter(Boolean)).size
  const readingTaker = (reading) => {
    const taker = reading.recordedBy ?? reading.reader ?? reading.createdBy ?? reading.meterReader ?? reading.recorder
    if (typeof taker === 'string') return taker || 'Not provided by API'
    if (taker && typeof taker === 'object') {
      return [taker.firstName, taker.middleName, taker.lastName].filter(Boolean).join(' ') || taker.name || taker.email || 'Not provided by API'
    }
    return reading.recordedByName || reading.readerName || reading.createdByName || 'Not provided by API'
  }
  const billingMonth = currentUtcBillingMonth()
  const submitEdit = handleEditSubmit(({ currentReading }) => {
    if (!canEditReading(editing, role, userId, currentUtcBillingMonth())) {
      toast.error(readingUpdateErrorMessage({ status: 403 }))
      return
    }
    updateMutation.mutate({ id: editing.id, currentReading })
  })
  return <>
    <PageTitle eyebrow="FIELD OPERATIONS / READINGS" title={role === 'ADMIN' ? 'Reading register' : 'Meter readings'} description={role === 'ADMIN' ? 'Review all meter readings and resolve exceptions.' : 'Record and review your current-month meter readings.'}
      action={<button className="button button-primary" onClick={() => { reset(); setSelectedCustomer(null); setShowForm((value) => !value) }}><Plus size={16} /> Record reading</button>} />
    <div className="bento-grid readings-grid">
      <section className="bento-card span-3 table-card">
        <div className="card-heading"><div><div className="eyebrow">{role === 'ADMIN' ? 'ALL BILLING PERIODS' : 'CURRENT BILLING PERIOD'}</div><h3>{role === 'ADMIN' ? 'Consumer consumption history' : 'Reading activity'}</h3></div><button className="icon-button" aria-label="Refresh readings" onClick={() => readingsQuery.refetch()}><RefreshCw size={16} /></button></div>
        {role === 'ADMIN' && <>
          <div className="reading-history-filters">
            <label><span>Consumer</span><select value={consumerFilter} onChange={(event) => setConsumerFilter(event.target.value)}><option value="">All consumers</option>{consumers.map((consumer) => <option key={consumer.id} value={consumer.id}>{[consumer.firstName, consumer.lastName].filter(Boolean).join(' ') || 'Consumer'} · {consumer.accountNumber || consumer.id}</option>)}</select></label>
            <label><span>Billing month</span><select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">All available months</option>{months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}</select></label>
          </div>
          {consumerFilter && <div className="reading-history-summary">
            <div><span>Consumer</span><b>{[selectedConsumer?.firstName, selectedConsumer?.lastName].filter(Boolean).join(' ') || selectedConsumer?.accountNumber || consumerFilter}</b></div>
            <div><span>Recorded months</span><b>{recordedMonthCount}</b></div>
            <div><span>Total recorded consumption{monthFilter ? ` · ${formatMonth(monthFilter)}` : ''}</span><b>{selectedConsumption.toLocaleString('en-KE')} units</b></div>
          </div>}
        </>}
        {readingsQuery.isLoading || (role === 'READER' && readingsQuery.isFetching) ? <LoadingState label="Loading readings" /> : readingsQuery.error ? <ErrorState error={readingsQuery.error} onRetry={() => readingsQuery.refetch()} /> : !readings.length ? <EmptyState icon={Gauge} title="No readings available" description={role === 'ADMIN' ? 'Reading submissions will appear as field staff record them.' : 'No meter readings have been recorded for this month.'} action={<button className="button button-secondary" onClick={() => setShowForm(true)}><Plus size={15} /> Record a reading</button>} /> : !filteredReadings.length ? <div className="directory-empty">No readings match the selected consumer and month.</div> :
          <div className="table-scroll"><table><thead><tr>{role === 'ADMIN' && <th>Billing month</th>}<th>Customer</th>{role === 'ADMIN' && <th>Previous reading</th>}<th>Reading</th><th>Consumption</th><th>Recorded</th>{role === 'ADMIN' && <th>Reading taken by</th>}<th>Review</th><th>Actions</th></tr></thead><tbody>{filteredReadings.map((reading) => <tr key={reading.id}>
            {role === 'ADMIN' && <td><b>{reading.billingMonth || reading.billingPeriod ? formatMonth(reading.billingMonth || reading.billingPeriod) : readingMonth(reading) ? formatMonth(readingMonth(reading)) : 'Month not provided'}</b></td>}
            <td><b>{reading.customer?.firstName ? `${reading.customer.firstName} ${reading.customer.lastName || ''}` : 'Customer'}</b><small className="table-subtext">{reading.customer?.accountNumber || reading.customerId || 'Customer ID unavailable'}</small></td>
            {role === 'ADMIN' && <td>{reading.previousReading ?? reading.previousMeterReading ?? reading.previousValue ?? '—'}</td>}
            <td className="money-cell">{reading.currentReading?.toLocaleString('en-KE') ?? '—'} units</td><td>{reading.consumptionUnits != null ? `${reading.consumptionUnits} units` : '—'}</td>
            <td>{reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
            {role === 'ADMIN' && <td>{readingTaker(reading)}</td>}
            <td>{reading.usageReview?.onHold ? <span className="review-flag">Admin review</span> : <span className="review-clear">Clear</span>}</td>
            <td><div className="row-actions">{canEditReading(reading, role, userId, billingMonth) && <button className="button button-small button-secondary" onClick={() => { setEditing(reading); resetEdit({ currentReading: reading.currentReading }) }}>Edit</button>}<button className="button button-small button-quiet" onClick={() => setDeleting(reading)}>Delete</button></div></td>
          </tr>)}</tbody></table></div>}
      </section>
      <aside className="bento-card span-1 reading-side">
        <div className="eyebrow">FIELD GUIDANCE</div><h3>Accurate by design</h3><p>Enter the current meter register value exactly as it appears. The API calculates previous reading, usage, invoice amount, and any review hold.</p>
        <div className="reading-guideline"><Check size={15} /><span>Whole numbers from 0 to 99,999</span></div>
        <div className="reading-guideline"><Check size={15} /><span>One reading per customer each month</span></div>
        <div className="reading-guideline"><Check size={15} /><span>Higher usage may be held for admin review</span></div>
        <div className="notice notice-info"><AlertCircle size={16} /><div><strong>Consumer search available</strong><p>Search the directory for consumer accounts. The API returns consumer records only for reader-role searches.</p></div></div>
      </aside>
    </div>
    {showForm && <Modal title="Record meter reading" onClose={() => { reset(); setSelectedCustomer(null); setShowForm(false) }}>
      <p className="modal-intro">Find a consumer account in the directory before entering the current meter value.</p>
      <form className="form-stack" onSubmit={handleSubmit((values) => recordMutation.mutate(values))} noValidate>
        <UserDirectorySearch
          roles={['CONSUMER']}
          roleFilter={false}
          locationFilter
          selectedId={selectedCustomer?.id}
          onSelect={(customer) => {
            setSelectedCustomer(customer)
            setValue('customerId', customer.id, { shouldDirty: true, shouldValidate: true })
          }}
        />
        {selectedCustomer && <div className="notice notice-success"><Check size={16} /><div><strong>{[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')}</strong><p>{selectedCustomer.accountNumber || 'Consumer account'} · {selectedCustomer.phoneNumber || 'Phone not listed'}</p></div></div>}
        {errors.customerId?.message && <div className="field-error-text" role="alert">{errors.customerId.message}</div>}
        <Field label="Current meter reading" hint="Whole number, 0–99,999 units." error={errors.currentReading?.message}><input type="number" min="0" max="99999" step="1" inputMode="numeric" placeholder="e.g. 12345" {...register('currentReading')} /></Field>
        {recordMutation.error && <ErrorState error={recordMutation.error} />}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => { reset(); setSelectedCustomer(null); setShowForm(false) }}>Cancel</button><button className="button button-primary" disabled={recordMutation.isPending || !selectedCustomer}>{recordMutation.isPending ? 'Saving…' : 'Submit reading'}</button></div>
      </form>
    </Modal>}
    {editing && <Modal title="Correct reading" onClose={() => setEditing(null)}>
      <p className="modal-intro">Corrections may recalculate later readings. Settled invoices can block this change.</p>
      <form className="form-stack" onSubmit={submitEdit} noValidate>
        <Field label="Current meter reading" error={editErrors.currentReading?.message}><input type="number" min="0" max="99999" step="1" {...registerEdit('currentReading')} /></Field>
        {updateMutation.error && role === 'READER' && updateMutation.error.status === 403
          ? <div className="notice notice-error" role="alert">{readingUpdateErrorMessage(updateMutation.error)}</div>
          : updateMutation.error && <ErrorState error={updateMutation.error} />}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save correction'}</button></div>
      </form>
    </Modal>}
    {deleting && <ConfirmDialog title="Delete this reading?" description="The backend rejects deletion if an invoice or later dependent reading exists." confirmLabel="Delete reading" danger busy={deleteMutation.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleteMutation.mutate(deleting.id)} />}
  </>
}
