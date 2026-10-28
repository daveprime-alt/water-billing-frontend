import { ApiError } from '../services/api.js'

export function nameOf(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'
}

export function getMessage(error) {
  if (error instanceof ApiError) return error.message
  return error?.message || 'Something went wrong. Please try again.'
}
