import { useState } from 'react'
import { formatKes, formatMonth } from '../../services/api.js'
import { Field, Modal } from '../ui/index.jsx'

const KENYAN_MOBILE_NUMBER = /^(?:\+?254|0)(?:7|1)\d{8}$/

export function PaymentDialog({ invoice, initialPhoneNumber = '', busy = false, onClose, onSubmit }) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [phoneError, setPhoneError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedPhoneNumber = phoneNumber.trim()
    if (!KENYAN_MOBILE_NUMBER.test(trimmedPhoneNumber)) {
      setPhoneError('Enter a valid Kenyan mobile number, such as 0712345678 or +254712345678.')
      return
    }

    setPhoneError('')
    onSubmit(trimmedPhoneNumber)
  }

  return (
    <Modal title="Pay your invoice" onClose={onClose}>
      <p className="modal-intro">
        Enter the mobile number that should receive the M-Pesa payment prompt.
      </p>
      <div className="payment-dialog-summary">
        <span>{formatMonth(invoice.billingMonth)}</span>
        <strong>{formatKes(invoice.closingReceivableCents ?? invoice.currentBillCents)}</strong>
      </div>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <Field label="M-Pesa phone number" error={phoneError} hint="Use a Kenyan mobile number, with or without the +254 prefix.">
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0712345678"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value)
              if (phoneError) setPhoneError('')
            }}
          />
        </Field>
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Sending prompt…' : 'Send payment prompt'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
