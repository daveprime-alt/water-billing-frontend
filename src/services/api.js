import { useAuthStore } from '../stores/authStore.js'

const API_REQUEST_TIMEOUT_MS = 20_000

/**
 * @typedef {import('./models').LoginRequest} LoginRequest
 * @typedef {import('./models').LoginResponse} LoginResponse
 * @typedef {import('./models').ChangePasswordRequest} ChangePasswordRequest
 * @typedef {import('./models').UserProfile} UserProfile
 * @typedef {import('./models').ProfileUpdateRequest} ProfileUpdateRequest
 * @typedef {import('./models').Invoice} Invoice
 * @typedef {import('./models').MeterReading} MeterReading
 * @typedef {import('./models').CreateReadingRequest} CreateReadingRequest
 * @typedef {import('./models').UpdateReadingRequest} UpdateReadingRequest
 * @typedef {import('./models').CreateUserRequest} CreateUserRequest
 * @typedef {import('./models').ImportCustomersResult} ImportCustomersResult
 * @typedef {import('./models').DirectoryUser} DirectoryUser
 * @typedef {import('./models').UserDirectoryResponse} UserDirectoryResponse
 * @typedef {import('./models').UserRole} UserRole
 */

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, headers = {}, isFormData = false } = {}) {
  const token = useAuthStore.getState().token
  const requestHeaders = new Headers(headers)
  if (!isFormData) {
    requestHeaders.set('Accept', 'application/json')
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text ? { error: text } : null
    }
    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().clearSession()
        window.dispatchEvent(new Event('water-billing:unauthorized'))
      }
      throw new ApiError(response.status, payload?.error || payload?.message || `Request failed (${response.status})`)
    }

    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) {
      throw new ApiError(408, `The server request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds. Check your connection and try again.`)
    }
    throw new ApiError(0, 'Server connection failed.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function normalizeUserDirectory(payload, requestedPage, requestedPageSize) {
  const source = payload?.data && !Array.isArray(payload.data) ? payload.data : payload
  const users = Array.isArray(payload) ? payload : source?.users ?? source?.results ?? source?.items ?? source?.data
  if (!Array.isArray(users)) {
    throw new ApiError(200, 'The user directory response did not include a users array.')
  }

  const pagination = source?.pagination || source?.meta || payload?.pagination || payload?.meta || {}
  const page = Number(pagination.page ?? pagination.currentPage ?? source?.page ?? source?.currentPage ?? requestedPage)
  const pageSize = Number(pagination.pageSize ?? pagination.perPage ?? source?.pageSize ?? source?.perPage ?? requestedPageSize)
  const total = Number(pagination.total ?? pagination.totalCount ?? pagination.totalItems ?? source?.total ?? source?.totalCount ?? source?.totalItems)
  const totalPages = Number(pagination.totalPages ?? pagination.lastPage ?? source?.totalPages ?? source?.lastPage ?? (Number.isFinite(total) ? Math.ceil(total / pageSize) : NaN))
  const hasNextPage = pagination.hasNextPage ?? source?.hasNextPage ?? (Number.isFinite(totalPages) ? page < totalPages : users.length === pageSize)

  return {
    users,
    page: Number.isFinite(page) && page > 0 ? page : requestedPage,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : requestedPageSize,
    total: Number.isFinite(total) ? total : undefined,
    totalPages: Number.isFinite(totalPages) ? totalPages : undefined,
    hasNextPage: Boolean(hasNextPage),
  }
}

const get = (path) => request(path)
const post = (path, body) => request(path, { method: 'POST', body })
const put = (path, body) => request(path, { method: 'PUT', body })

/** @type {{
 * login: (body: LoginRequest) => Promise<LoginResponse>,
 * changePassword: (body: ChangePasswordRequest) => Promise<{message: string}>,
 * getProfile: () => Promise<UserProfile>,
 * updateProfile: (body: ProfileUpdateRequest) => Promise<UserProfile>,
 * getMyBills: () => Promise<Invoice[]>,
 * getInvoices: () => Promise<Invoice[]>,
 * payInvoice: (id: string, body: {phoneNumber: string}) => Promise<{message: string, checkoutRequestId: string}>,
 * cancelInvoice: (id: string) => Promise<{message: string}>,
 * getReadings: () => Promise<MeterReading[]>,
 * getReading: (id: string) => Promise<MeterReading>,
 * createReading: (body: CreateReadingRequest) => Promise<{message: string, invoice: Invoice, usageReview: {onHold: boolean, averageUnits: number|null, threshold: number|null, previousReadingsCount: number}}>,
 * updateReading: (id: string, body: UpdateReadingRequest) => Promise<MeterReading>,
 * deleteReading: (id: string) => Promise<{message: string}>,
 * createUser: (body: CreateUserRequest) => Promise<{message: string, user?: UserProfile}>,
 * deleteUser: (id: string) => Promise<{message?: string}>,
 * importCustomers: (file: File) => Promise<ImportCustomersResult>,
 * resetUserPassword: (id: string) => Promise<{message: string}>,
 * updateUserPhone: (id: string, body: {phoneNumber: string}) => Promise<{message: string}>,
 * deleteUserPhone: (id: string) => Promise<{message?: string}>,
 * getUserDirectory: (params?: {search?: string, page?: number, pageSize?: number, role?: UserRole}) => Promise<UserDirectoryResponse>,
 * getUserById: (id: string) => Promise<UserProfile>,
 * logout: () => Promise<{message?: string}>,
 * getHealth: () => Promise<unknown>
 * }} */
export const api = {
  login: (body) => post('/api/users/login', body),
  changePassword: (body) => post('/api/users/change-password', body),
  getProfile: () => get('/api/users/profile'),
  updateProfile: (body) => put('/api/users/profile', body),
  getMyBills: () => get('/api/invoices/my-bills'),
  getInvoices: () => get('/api/invoices'),
  payInvoice: (id, body) => post(`/api/invoices/${encodeURIComponent(id)}/pay`, body),
  cancelInvoice: (id) => put(`/api/invoices/${encodeURIComponent(id)}/cancel`),
  getReadings: () => get('/api/readings'),
  getReading: (id) => get(`/api/readings/${encodeURIComponent(id)}`),
  createReading: (body) => post('/api/readings', body),
  updateReading: (id, body) => put(`/api/readings/${encodeURIComponent(id)}`, body),
  deleteReading: (id) => request(`/api/readings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createUser: (body) => post('/api/admin/users', body),
  deleteUser: (id) => request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  importCustomers: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/api/admin/import-customers', { method: 'POST', body: formData, isFormData: true })
  },
  resetUserPassword: (id) => post(`/api/admin/users/${encodeURIComponent(id)}/reset-password`),
  updateUserPhone: (id, body) => request(`/api/admin/users/${encodeURIComponent(id)}/phone`, { method: 'PATCH', body }),
  deleteUserPhone: (id) => request(`/api/admin/users/${encodeURIComponent(id)}/phone`, { method: 'DELETE' }),
  logout: () => post('/api/admin/logout'),
  getHealth: () => get('/health'),
  getUserDirectory: ({ search, page = 1, pageSize = 20, role } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search?.trim()) params.set('search', search.trim())
    if (role) params.set('role', role)
    return get(`/api/users/directory?${params}`).then((payload) => normalizeUserDirectory(payload, page, pageSize))
  },
  getSmsMessages: ({ status = 'FAILED', page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) })
    return get(`/api/admin/sms/messages?${params}`)
  },
  retrySmsMessage: (id) => post(`/api/admin/sms/messages/${encodeURIComponent(id)}/retry`),
  getSmsAnnouncementPreferences: ({ optedOut, page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (optedOut !== undefined) params.set('optedOut', String(optedOut))
    return get(`/api/admin/sms/announcement-preferences?${params}`)
  },
  updateSmsAnnouncementPreference: (userId, optedOut) => request(
    `/api/admin/sms/announcement-preferences/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: { optedOut } },
  ),
  createSmsCampaign: (message) => post('/api/admin/sms/campaigns', { message }),
  previewSmsCampaign: (id) => post(`/api/admin/sms/campaigns/${encodeURIComponent(id)}/preview`),
  confirmSmsCampaign: (id) => post(`/api/admin/sms/campaigns/${encodeURIComponent(id)}/confirm`),
  getSmsCampaigns: ({ page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    return get(`/api/admin/sms/campaigns?${params}`)
  },
  pauseSmsCampaign: (id) => post(`/api/admin/sms/campaigns/${encodeURIComponent(id)}/pause`),
  resumeSmsCampaign: (id) => post(`/api/admin/sms/campaigns/${encodeURIComponent(id)}/resume`),
  getSmsAudit: ({ page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    return get(`/api/admin/sms/audit?${params}`)
  },
  getUserById: (id) => get(`/api/users/${encodeURIComponent(id)}`),
}

export function formatKes(cents) {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return '—'
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(cents) / 100)
}

export function formatMonth(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-KE', { month: 'short', year: 'numeric' }).format(date)
}
