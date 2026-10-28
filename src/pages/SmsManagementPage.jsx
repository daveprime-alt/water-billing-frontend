import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Bell, ChevronLeft, ChevronRight, Clock3, MessageSquare, Pause, Play, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '../services/api.js'
import { nameOf } from '../utils/formatters.js'
import { ConfirmDialog, Field, LoadingState, PageTitle } from '../components/ui/index.jsx'

const PAGE_SIZE = 25
const MESSAGE_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED']
const PANELS = [
  { id: 'queue', label: 'SMS queue', icon: MessageSquare },
  { id: 'preferences', label: 'Announcement preferences', icon: Bell },
  { id: 'campaigns', label: 'Announcements', icon: Send },
  { id: 'audit', label: 'Audit history', icon: ShieldCheck },
]

function responseData(payload) {
  return payload?.data ?? payload
}

function readList(payload, keys) {
  const data = responseData(payload)
  if (Array.isArray(data)) return { items: data, pagination: {} }
  const items = keys.map((key) => data?.[key]).find(Array.isArray)
    || data?.items
    || data?.results
  if (!Array.isArray(items)) throw new Error('The SMS API response did not contain a list.')
  return { items, pagination: data.pagination ?? data.meta ?? payload?.pagination ?? payload?.meta ?? data }
}

function totalFor({ pagination }, page) {
  const total = Number(pagination.total ?? pagination.totalCount ?? pagination.totalItems)
  if (Number.isFinite(total)) return `${total.toLocaleString()} total`
  const totalPages = Number(pagination.totalPages ?? pagination.lastPage)
  if (Number.isFinite(totalPages)) return `Page ${page} of ${totalPages}`
  return `Page ${page}`
}

function hasNextPage({ items, pagination }, page) {
  if (pagination.hasNextPage !== undefined) return Boolean(pagination.hasNextPage)
  const totalPages = Number(pagination.totalPages ?? pagination.lastPage)
  if (Number.isFinite(totalPages)) return page < totalPages
  return items.length === PAGE_SIZE
}

function maskedPhone(value) {
  if (!value) return 'Not available'
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return 'Not available'
  return `•••• ${digits.slice(-4)}`
}

function auditLabel(value) {
  if (typeof value !== 'string') return '—'
  return /\+?\d[\d\s().-]{7,}\d/.test(value) ? maskedPhone(value) : safeErrorText(value)
}

function safeErrorText(value) {
  return String(value || '')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [redacted]')
    .replace(/\b(api[_ -]?key|token|password|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone redacted]')
}

function SmsError({ error, onRetry }) {
  const status = error instanceof ApiError ? error.status : undefined
  const message = status === 401
    ? 'Your session has expired. Sign in again to continue.'
    : status === 403
      ? 'Your account is not permitted to manage SMS.'
      : status === 404
        ? 'The SMS management endpoint is not available.'
        : status === 409
          ? 'The request conflicts with current SMS data. Refresh and try again.'
          : status === 0 || status === 408
            ? 'The API could not be reached. Check your connection and try again.'
            : 'The SMS request could not be completed. Check the data and try again.'
  return (
    <div className="notice notice-error sms-error" role="alert">
      <AlertCircle size={18} />
      <div><strong>{status === 401 ? 'Session expired' : status === 403 ? 'Access restricted' : 'SMS request failed'}</strong><p>{message}</p></div>
      {onRetry && <button className="icon-button" aria-label="Retry request" onClick={onRetry}><RefreshCw size={16} /></button>}
    </div>
  )
}

function Pagination({ page, list, onPageChange, busy }) {
  return (
    <div className="directory-pagination sms-pagination">
      <span>{totalFor(list, page)}</span>
      <div>
        <button className="button button-small button-secondary" disabled={page <= 1 || busy} onClick={() => onPageChange(page - 1)}><ChevronLeft size={14} /> Previous</button>
        <button className="button button-small button-secondary" disabled={!hasNextPage(list, page) || busy} onClick={() => onPageChange(page + 1)}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

function SmsStatus({ status }) {
  const safeStatus = String(status || 'UNKNOWN').toUpperCase()
  return <span className={`sms-status sms-status-${safeStatus.toLowerCase()}`}>{safeStatus.replaceAll('_', ' ')}</span>
}

function displayTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function messageRecipient(message) {
  return maskedPhone(message.maskedRecipient ?? message.recipientMasked ?? message.recipientPhone ?? message.phoneNumber ?? message.recipient)
}

function messageText(message) {
  return message.message ?? message.body ?? message.text ?? 'Message content unavailable'
}

function smsMetaValue(key, value) {
  if (/phone|recipient|mobile/i.test(key)) return maskedPhone(value)
  if (typeof value === 'string') return safeErrorText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  return Object.entries(metadata).flatMap(([key, value]) => {
    if (/phone|recipient|mobile/i.test(key)) return [[key, smsMetaValue(key, value)]]
    if (!/count|status|type|reason|result|attempt|campaign|changed|opt.?out|preview|duration|source/i.test(key)) return []
    if (/key|token|secret|password|auth|message|body|credential/i.test(key)) return []
    const safeValue = smsMetaValue(key, value)
    return safeValue ? [[key, safeValue]] : []
  })
}

function SmsQueue() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('FAILED')
  const [page, setPage] = useState(1)
  const [retryTarget, setRetryTarget] = useState(null)
  const listQuery = useQuery({
    queryKey: ['admin-sms', 'messages', status, page],
    queryFn: async () => readList(await api.getSmsMessages({ status, page, pageSize: PAGE_SIZE }), ['messages']),
  })
  const retryMutation = useMutation({
    mutationFn: api.retrySmsMessage,
    onSuccess: () => {
      toast.success('Message queued for retry.')
      setRetryTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-sms', 'messages'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError && error.status === 403 ? 'You are not permitted to retry this message.' : 'The message could not be retried.')
      setRetryTarget(null)
    },
  })

  return (
    <section className="bento-card span-3 sms-panel">
      <div className="card-heading"><div><div className="eyebrow">OUTBOUND MESSAGES</div><h3>SMS queue</h3></div><label className="sms-filter"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>{MESSAGE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="notice notice-info sms-notice"><AlertCircle size={16} /><div><strong>Delivery status</strong><p>SENT means Africa’s Talking accepted the send request; it does not confirm delivery to the handset.</p></div></div>
      {listQuery.isLoading ? <LoadingState label="Loading SMS queue" /> : listQuery.error ? <SmsError error={listQuery.error} onRetry={() => listQuery.refetch()} /> : listQuery.data.items.length === 0 ? <div className="directory-empty sms-empty">There are no messages with this status.</div> : <>
        <div className="table-scroll sms-table-wrap"><table className="sms-table"><thead><tr><th>Type / message</th><th>Recipient</th><th>Status</th><th>Attempts</th><th>Next / sent / failed</th><th>Last error / history</th><th>Action</th></tr></thead>
          <tbody>{listQuery.data.items.map((message) => {
            const redacted = Boolean(message.redacted || message.isRedacted || message.expired || message.isExpired)
            const attempts = message.attemptHistory ?? message.attemptsHistory ?? []
            return <tr key={message.id}>
              <td><b>{message.type ?? message.messageType ?? 'SMS'}</b><small className="sms-message-copy">{messageText(message)}</small></td>
              <td>{messageRecipient(message)}</td>
              <td><SmsStatus status={message.status} /></td>
              <td>{message.attemptCount ?? message.attempts ?? 0}</td>
              <td>{displayTime(message.nextRetryAt ?? message.sentAt ?? message.failedAt)}</td>
              <td className="sms-history-cell">
                {message.lastError ? <small>{safeErrorText(message.lastError)}</small> : <small>—</small>}
                {Array.isArray(attempts) && attempts.length > 0 && <details><summary>{attempts.length} attempt{attempts.length === 1 ? '' : 's'}</summary><ul>{attempts.map((attempt, index) => <li key={attempt.id ?? index}>{displayTime(attempt.createdAt ?? attempt.at ?? attempt.timestamp)} · {safeErrorText(attempt.status ?? attempt.error ?? attempt.result ?? 'Attempt')}</li>)}</ul></details>}
                {redacted && <small className="sms-muted">Content redacted or expired</small>}
              </td>
              <td>{String(message.status).toUpperCase() === 'FAILED' && !redacted && message.id
                ? <button className="button button-small button-secondary" onClick={() => setRetryTarget(message)}>Retry</button>
                : '—'}</td>
            </tr>
          })}</tbody>
        </table></div>
        <Pagination page={page} list={listQuery.data} onPageChange={setPage} busy={listQuery.isFetching} />
      </>}
      {retryTarget && <ConfirmDialog title="Retry this SMS?" description="This will queue the failed message for another send attempt. Confirm the recipient and message before continuing." confirmLabel="Queue retry" busy={retryMutation.isPending} onClose={() => setRetryTarget(null)} onConfirm={() => retryMutation.mutate(retryTarget.id)} />}
    </section>
  )
}

function SmsPreferences() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const optedOut = filter === '' ? undefined : filter === 'true'
  const listQuery = useQuery({
    queryKey: ['admin-sms', 'preferences', filter, page],
    queryFn: async () => readList(await api.getSmsAnnouncementPreferences({ optedOut, page, pageSize: PAGE_SIZE }), ['preferences', 'announcementPreferences']),
  })
  const mutation = useMutation({
    mutationFn: ({ userId, value }) => api.updateSmsAnnouncementPreference(userId, value),
    onSuccess: (_, variables) => {
      toast.success(variables.value ? 'Announcement opt-out recorded.' : 'Announcement opt-out cleared.')
      queryClient.invalidateQueries({ queryKey: ['admin-sms', 'preferences'] })
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 403 ? 'You are not permitted to change this preference.' : 'The preference could not be updated.'),
  })

  return (
    <section className="bento-card span-3 sms-panel">
      <div className="card-heading"><div><div className="eyebrow">OPERATIONAL ANNOUNCEMENTS</div><h3>Recipient preferences</h3></div><label className="sms-filter"><span>Opt-out</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}><option value="">All preferences</option><option value="true">Opted out</option><option value="false">Not opted out</option></select></label></div>
      <div className="notice notice-info sms-notice"><AlertCircle size={16} /><div><strong>Scope of these preferences</strong><p>These preferences apply to operational announcements only. They do not change transactional billing or payment SMS.</p></div></div>
      {listQuery.isLoading ? <LoadingState label="Loading announcement preferences" /> : listQuery.error ? <SmsError error={listQuery.error} onRetry={() => listQuery.refetch()} /> : listQuery.data.items.length === 0 ? <div className="directory-empty sms-empty">No announcement preferences found.</div> : <>
        <div className="table-scroll sms-table-wrap"><table className="sms-table"><thead><tr><th>Name</th><th>Phone</th><th>Announcement status</th><th>Opted out at</th><th>Action</th></tr></thead>
          <tbody>{listQuery.data.items.map((preference) => {
            const user = preference.user ?? preference
            const isOptedOut = Boolean(preference.optedOut)
            const userId = preference.userId ?? user.id
            return <tr key={userId}>
              <td>{nameOf(user)}</td><td>{maskedPhone(preference.maskedPhone ?? preference.phoneNumber ?? user.phoneNumber)}</td>
              <td><SmsStatus status={isOptedOut ? 'OPTED_OUT' : 'ACTIVE'} /></td>
              <td>{displayTime(preference.optedOutAt ?? preference.optOutAt)}</td>
              <td><button className={`button button-small ${isOptedOut ? 'button-secondary' : 'button-quiet'}`} disabled={mutation.isPending} onClick={() => mutation.mutate({ userId, value: !isOptedOut })}>{isOptedOut ? 'Clear opt-out' : 'Record opt-out'}</button></td>
            </tr>
          })}</tbody>
        </table></div>
        <Pagination page={page} list={listQuery.data} onPageChange={setPage} busy={listQuery.isFetching} />
      </>}
    </section>
  )
}

function campaignId(campaign) {
  return campaign?.id ?? campaign?.campaignId ?? campaign?.campaign?.id
}

function campaignCounts(campaign) {
  const counts = campaign.counts ?? campaign.progress ?? campaign.deliveryProgress ?? {}
  return ['sent', 'pending', 'processing', 'failed', 'cancelled'].map((key) => [
    key,
    counts[key] ?? campaign[`${key}Count`] ?? campaign[`${key}Messages`] ?? 0,
  ])
}

function campaignRecipients(preview) {
  return preview?.eligibleRecipients ?? preview?.recipients ?? preview?.eligible?.recipients ?? []
}

function SmsCampaigns() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [previewState, setPreviewState] = useState(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!previewState) return undefined
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [previewState])
  const listQuery = useQuery({
    queryKey: ['admin-sms', 'campaigns', page],
    queryFn: async () => readList(await api.getSmsCampaigns({ page, pageSize: PAGE_SIZE }), ['campaigns']),
  })
  const createMutation = useMutation({
    mutationFn: api.createSmsCampaign,
    onSuccess: (result) => {
      const payload = responseData(result)
      const campaign = payload?.campaign ?? payload
      setSelectedCampaign(campaign)
      setPreviewState(null)
      setMessage('')
      toast.success('Announcement draft created. Preview the recipients before sending.')
      queryClient.invalidateQueries({ queryKey: ['admin-sms', 'campaigns'] })
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 403 ? 'You are not permitted to create announcements.' : 'The announcement draft could not be created.'),
  })
  const previewMutation = useMutation({
    mutationFn: api.previewSmsCampaign,
    onSuccess: (result, id) => {
      const data = responseData(result)
      setPreviewState({ id, data, createdAt: Date.now(), expiresAt: data?.previewExpiresAt ?? data?.expiresAt })
      toast.success('Fresh recipient preview ready.')
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 403 ? 'You are not permitted to preview this announcement.' : 'The recipient preview could not be created.'),
  })
  const confirmMutation = useMutation({
    mutationFn: api.confirmSmsCampaign,
    onSuccess: () => {
      setConfirmSend(false)
      setPreviewState(null)
      toast.success('Announcement confirmed for paced sending.')
      queryClient.invalidateQueries({ queryKey: ['admin-sms', 'campaigns'] })
    },
    onError: (error) => {
      setConfirmSend(false)
      if (error instanceof ApiError && error.status === 409) {
        setPreviewState(null)
        toast.error('The eligible recipient count changed. Create a fresh preview before confirming.')
      } else {
        toast.error(error instanceof ApiError && error.status === 403 ? 'You are not permitted to send this announcement.' : 'The announcement could not be confirmed.')
      }
    },
  })
  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => action === 'pause' ? api.pauseSmsCampaign(id) : api.resumeSmsCampaign(id),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'pause' ? 'Announcement paused.' : 'Announcement resumed.')
      queryClient.invalidateQueries({ queryKey: ['admin-sms', 'campaigns'] })
    },
    onError: () => toast.error('The announcement status could not be changed.'),
  })

  const selectedId = campaignId(selectedCampaign)
  const previewId = previewState?.id
  const previewData = previewState?.data
  const previewRecipients = useMemo(() => campaignRecipients(previewData), [previewData])
  const previewCount = Number(
    previewData?.eligibleRecipientCount
    ?? previewData?.recipientCount
    ?? previewData?.eligibleCount
    ?? previewData?.eligible?.count
    ?? previewRecipients.length,
  )
  const previewExpiry = previewState
    ? new Date(previewState.expiresAt ?? previewState.createdAt + 10 * 60 * 1000).getTime()
    : null
  const previewExpired = Boolean(previewState && (!Number.isFinite(previewExpiry) || now >= previewExpiry))
  const previewOverLimit = previewCount > 1000 || Boolean(previewData?.overLimit ?? previewData?.isOverLimit)
  const previewTruncated = Boolean(previewData?.truncated ?? previewData?.isTruncated)
  const chosenMessage = previewData?.message ?? selectedCampaign?.message ?? selectedCampaign?.body ?? ''

  return (
    <>
      <section className="bento-card span-3 sms-panel">
        <div className="card-heading"><div><div className="eyebrow">WATER-SERVICE NOTICES</div><h3>Operational announcements</h3></div></div>
        <div className="notice notice-warning sms-notice"><AlertCircle size={16} /><div><strong>Operational notices only</strong><p>Announcements must concern operational water services, not promotions. Sends are paced; a send already in flight may finish after pausing.</p><p>Preview expires after 10 minutes. Confirmation fails if the eligible recipient count changes; create a fresh preview after a conflict.</p></div></div>
        <form className="sms-compose" onSubmit={(event) => { event.preventDefault(); if (message.trim()) createMutation.mutate(message.trim()) }}>
          <Field label="New announcement draft" hint="Write an operational water-service notice. Recipients must be opted in.">
            <textarea rows="4" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type an operational water-service notice…" />
          </Field>
          {message.length > 0 && !message.trim() && <small className="field-error-text">Enter a message before creating a draft.</small>}
          <button className="button button-primary" type="submit" disabled={!message.trim() || createMutation.isPending}>{createMutation.isPending ? 'Creating draft…' : 'Create draft'}</button>
        </form>

        {selectedCampaign && selectedId && <div className="sms-preview">
          <div className="card-heading"><div><div className="eyebrow">DRAFT PREVIEW</div><h3>Review before sending</h3></div><SmsStatus status={selectedCampaign.status ?? 'DRAFT'} /></div>
          <p className="sms-full-message">{chosenMessage || 'Campaign message unavailable'}</p>
          {previewState && previewId === selectedId && <>
            <div className="sms-preview-summary">
              <div><span>Eligible recipients</span><b>{previewCount.toLocaleString()}</b></div>
              <div><span>Preview expires</span><b>{previewExpired ? 'Expired — preview again' : displayTime(previewExpiry)}</b></div>
            </div>
            {previewTruncated && <div className="notice notice-warning sms-notice"><AlertCircle size={16} /><div><strong>Recipient list truncated</strong><p>The preview reports a truncated recipient list. The count above is the exact eligible count returned by the API.</p></div></div>}
            {previewOverLimit && <div className="notice notice-error sms-notice"><AlertCircle size={16} /><div><strong>Campaign exceeds the 1,000-recipient limit</strong><p>Reduce the eligible audience before attempting confirmation.</p></div></div>}
            {previewData?.warning && <div className="notice notice-warning sms-notice"><AlertCircle size={16} /><div><strong>Preview warning</strong><p>{safeErrorText(previewData.warning)}</p></div></div>}
            <div className="sms-recipient-list"><b>Masked recipients</b>{previewRecipients.length === 0 ? <p>No recipient details were returned in this preview.</p> : <ul>{previewRecipients.map((recipient, index) => {
              const item = recipient.user ?? recipient
              return <li key={recipient.id ?? item.id ?? index}>{nameOf(item)} <span>{maskedPhone(recipient.maskedPhone ?? recipient.phoneNumber ?? recipient.recipient ?? item.phoneNumber)}</span></li>
            })}</ul>}</div>
          </>}
          <div className="sms-actions">
            <button className="button button-secondary" disabled={previewMutation.isPending || !selectedId} onClick={() => previewMutation.mutate(selectedId)}>{previewMutation.isPending ? 'Preparing preview…' : previewState ? 'Refresh preview' : 'Preview recipients'}</button>
            {previewState && previewId === selectedId && <button className="button button-primary" disabled={previewExpired || previewOverLimit || confirmMutation.isPending} onClick={() => setConfirmSend(true)}>Confirm and send</button>}
          </div>
        </div>}

        <div className="card-heading sms-campaign-heading"><div><div className="eyebrow">CAMPAIGN HISTORY</div><h3>Campaigns</h3></div><button className="icon-button" aria-label="Refresh campaigns" onClick={() => listQuery.refetch()}><RefreshCw size={16} /></button></div>
        {listQuery.isLoading ? <LoadingState label="Loading campaigns" /> : listQuery.error ? <SmsError error={listQuery.error} onRetry={() => listQuery.refetch()} /> : listQuery.data.items.length === 0 ? <div className="directory-empty sms-empty">No announcement campaigns have been created.</div> : <>
          <div className="table-scroll sms-table-wrap"><table className="sms-table"><thead><tr><th>Campaign</th><th>Status</th><th>Delivery progress</th><th>Action</th></tr></thead>
            <tbody>{listQuery.data.items.map((campaign) => {
              const id = campaignId(campaign)
              const selected = id === selectedId
              const status = String(campaign.status ?? '').toUpperCase()
              const canPause = ['QUEUED', 'PENDING', 'SENDING', 'PROCESSING', 'RUNNING'].includes(status)
              const canResume = status === 'PAUSED'
              return <tr key={id}>
                <td><button className="sms-campaign-select" onClick={() => { setSelectedCampaign(campaign); setPreviewState(null) }}><b>{campaign.name ?? campaign.title ?? `Announcement ${id ?? ''}`}</b></button><small className="table-subtext">{displayTime(campaign.createdAt)}</small></td>
                <td><SmsStatus status={campaign.status} /></td>
                <td><div className="sms-counts">{campaignCounts(campaign).map(([key, count]) => <span key={key}><b>{Number(count).toLocaleString()}</b> {key}</span>)}</div></td>
                <td className="sms-actions-cell">
                  <button className="button button-small button-secondary" onClick={() => { setSelectedCampaign(campaign); setPreviewState(null) }}>{selected ? 'Selected' : 'Review'}</button>
                  {canPause && <button className="button button-small button-quiet" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id, action: 'pause' })}><Pause size={13} /> Pause</button>}
                  {canResume && <button className="button button-small button-secondary" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id, action: 'resume' })}><Play size={13} /> Resume</button>}
                </td>
              </tr>
            })}</tbody>
          </table></div>
          <Pagination page={page} list={listQuery.data} onPageChange={setPage} busy={listQuery.isFetching} />
        </>}
        {confirmSend && <ConfirmDialog title="Send this operational announcement?" description={`This confirms the current preview for ${previewCount.toLocaleString()} eligible recipients. The preview must be less than 10 minutes old, and the API will reject it if the eligible count changed.`} confirmLabel="Confirm and send" busy={confirmMutation.isPending} onClose={() => setConfirmSend(false)} onConfirm={() => confirmMutation.mutate(selectedId)} />}
      </section>
    </>
  )
}

function SmsAudit() {
  const [page, setPage] = useState(1)
  const listQuery = useQuery({
    queryKey: ['admin-sms', 'audit', page],
    queryFn: async () => readList(await api.getSmsAudit({ page, pageSize: PAGE_SIZE }), ['actions', 'audit', 'events']),
  })

  return (
    <section className="bento-card span-3 sms-panel">
      <div className="card-heading"><div><div className="eyebrow">ADMINISTRATOR ACTIVITY</div><h3>SMS audit history</h3></div></div>
      {listQuery.isLoading ? <LoadingState label="Loading SMS audit history" /> : listQuery.error ? <SmsError error={listQuery.error} onRetry={() => listQuery.refetch()} /> : listQuery.data.items.length === 0 ? <div className="directory-empty sms-empty">No SMS administration actions found.</div> : <>
        <div className="table-scroll sms-table-wrap"><table className="sms-table"><thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Safe metadata</th><th>Timestamp</th></tr></thead>
          <tbody>{listQuery.data.items.map((entry, index) => {
            const actor = entry.actor ?? entry.admin ?? {}
            const target = entry.target ?? entry.targetUser ?? {}
            const metadata = safeMetadata(entry.metadata ?? entry.details)
            return <tr key={entry.id ?? index}>
              <td>{typeof actor === 'string' ? auditLabel(actor) : nameOf(actor)}</td>
              <td>{entry.action ?? entry.event ?? '—'}</td>
              <td>{typeof target === 'string' ? auditLabel(target) : nameOf(target) !== 'Account' ? nameOf(target) : target.id ?? '—'}</td>
              <td>{metadata.length ? <dl className="sms-audit-meta">{metadata.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : '—'}</td>
              <td>{displayTime(entry.createdAt ?? entry.timestamp ?? entry.at)}</td>
            </tr>
          })}</tbody>
        </table></div>
        <Pagination page={page} list={listQuery.data} onPageChange={setPage} busy={listQuery.isFetching} />
      </>}
    </section>
  )
}

export function SmsManagementPage() {
  const [activePanel, setActivePanel] = useState('queue')
  const activeView = {
    queue: <SmsQueue />,
    preferences: <SmsPreferences />,
    campaigns: <SmsCampaigns />,
    audit: <SmsAudit />,
  }[activePanel]

  return <>
    <PageTitle eyebrow="ADMINISTRATION / SMS" title="SMS management" description="Manage outbound message processing, announcement preferences, campaigns, and audit history." />
    <div className="tab-list sms-tabs" role="tablist" aria-label="SMS management">
      {PANELS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={activePanel === id} className={activePanel === id ? 'selected' : ''} onClick={() => setActivePanel(id)}><Icon size={15} /> {label}</button>)}
    </div>
    <div className="bento-grid sms-grid">{activeView}</div>
    <div className="sms-footer-note"><Clock3 size={15} /><span>All SMS controls require administrator access. Phone numbers are masked in this interface.</span></div>
  </>
}
