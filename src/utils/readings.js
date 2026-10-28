export const READER_EDIT_DENIED_MESSAGE = 'You can only edit readings you recorded in the current billing month.'

export function currentUtcBillingMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function readingUtcBillingMonth(reading) {
  const period = reading.billingMonth || reading.billingPeriod
  if (typeof period === 'string' && /^\d{4}-\d{2}/.test(period)) return period.slice(0, 7)

  const timestamp = period || reading.createdAt
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : currentUtcBillingMonth(date)
}

function readerIdOf(reading) {
  const recordedBy = reading.recordedBy ?? reading.reader ?? reading.createdBy ?? reading.meterReader ?? reading.recorder
  return reading.recordedById
    ?? reading.readerId
    ?? reading.createdById
    ?? reading.recorderId
    ?? (typeof recordedBy === 'object' ? recordedBy?.id : recordedBy)
}

export function canEditReading(reading, role, userId, billingMonth) {
  if (role === 'ADMIN') return true
  return role === 'READER'
    && Boolean(userId)
    && String(readerIdOf(reading) || '') === String(userId)
    && readingUtcBillingMonth(reading) === billingMonth
}

export function readingsForDisplay(readings, role, isFetching, hasError = false) {
  if (role === 'READER' && (isFetching || hasError)) return []
  return Array.isArray(readings) ? readings : []
}

export function readingUpdateErrorMessage(error) {
  return error?.status === 403 ? READER_EDIT_DENIED_MESSAGE : error?.message || 'Something went wrong. Please try again.'
}
