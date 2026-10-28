import { cloneElement, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, FileText, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { ApiError } from '../../services/api.js'
import { getMessage } from '../../utils/formatters.js'

export function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatusBadge({ status }) {
  const labels = {
    UNPAID: 'Unpaid',
    PENDING_PAYMENT: 'Payment pending',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
    ADMIN_HOLD: 'Admin review',
  }
  return <span className={`status-badge status-${status?.toLowerCase() || 'unknown'}`}><span />{labels[status] || status || 'Unknown'}</span>
}

export function EmptyState({ icon: Icon = FileText, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const status = error instanceof ApiError ? error.status : undefined
  const heading = status === 401 ? 'Session expired' : status === 403 ? 'Access restricted' : status === 404 ? 'Not found' : status === 409 ? 'This action conflicts with current data' : 'We could not load this data'
  return (
    <div className="notice notice-error" role="alert">
      <AlertCircle size={18} />
      <div><strong>{heading}</strong><p>{getMessage(error)}</p></div>
      {onRetry && <button className="icon-button" aria-label="Retry" onClick={onRetry}><RefreshCw size={16} /></button>}
    </div>
  )
}

export function LoadingState({ label = 'Loading your information' }) {
  return <div className="loading-state"><LoaderCircle size={20} className="spin" />{label}</div>
}

export function Field({ label, error, hint, children, className = '' }) {
  const fieldId = useId()
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(' ') || undefined
  const control = cloneElement(children, { id: children.props.id || fieldId, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })
  return <div className={`field ${error ? 'field-error' : ''} ${className}`}><label htmlFor={fieldId}>{label}</label>{control}{hint && <small id={`${fieldId}-hint`} className="field-hint">{hint}</small>}{error && <small id={`${fieldId}-error`} className="field-error-text" role="alert">{error}</small>}</div>
}

export function PasswordInput(props) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Hide password' : 'Show password'

  return (
    <span className="password-input-wrap">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        className="password-visibility-toggle"
        type="button"
        aria-label={label}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  )
}

export function ConfirmDialog({ title, description, confirmLabel, danger = false, busy = false, onClose, onConfirm }) {
  useEffect(() => {
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])
  return <Modal title={title} onClose={onClose}>
    <p className="modal-intro">{description}</p>
    <div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Go back</button><button className={`button ${danger ? 'button-danger' : 'button-primary'}`} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button></div>
  </Modal>
}

export function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>
}

export function NotFoundPage() {
  return <div className="bento-card not-found"><div className="eyebrow">404 / NOT FOUND</div><h1>This page is not available.</h1><p>The page may have moved or your account may not have access to it.</p><Link className="button button-primary" to="/">Return to overview <ArrowRight size={15} /></Link></div>
}
