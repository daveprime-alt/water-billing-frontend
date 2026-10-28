export type UserRole = 'ADMIN' | 'READER' | 'CONSUMER'

export type InvoiceStatus =
  | 'UNPAID'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CANCELLED'
  | 'ADMIN_HOLD'

export interface UserProfile {
  id: string
  accountNumber?: string | null
  firstName: string
  middleName?: string | null
  lastName: string
  phoneNumber: string
  role: UserRole
  location?: string | null
}

export type DirectoryUser = Pick<
  UserProfile,
  'id' | 'accountNumber' | 'firstName' | 'middleName' | 'lastName' | 'phoneNumber' | 'role' | 'location'
>

export interface UserDirectoryResponse {
  users: DirectoryUser[]
  page: number
  pageSize: number
  total?: number
  totalPages?: number
  hasNextPage?: boolean
}

export interface LoginRequest {
  phoneNumber: string
  password: string
}

export interface LoginResponse {
  message: string
  token: string
  mustChangePassword: boolean
  user: UserProfile
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ProfileUpdateRequest {
  firstName?: string
  middleName?: string | null
  lastName?: string
  location?: string | null
}

export interface Invoice {
  id: string
  currentBillCents: number
  consumptionUnits?: number | null
  openingReceivableCents: number
  paymentCreditsCents: number
  kplcAdjustmentCents: number
  closingReceivableCents: number
  unitRateCents: number
  status: InvoiceStatus
  billingMonth: string
  dueDate?: string | null
  createdAt?: string
  customer?: Pick<UserProfile, 'id' | 'accountNumber' | 'firstName' | 'lastName'>
}

export interface MeterReading {
  id: string
  customerId: string
  currentReading: number
  previousReading?: number | null
  previousMeterReading?: number | null
  consumptionUnits?: number
  billingMonth?: string | null
  billingPeriod?: string | null
  createdAt?: string
  recordedBy?: string | Pick<UserProfile, 'id' | 'firstName' | 'middleName' | 'lastName'> | null
  recordedByName?: string | null
  readerName?: string | null
  createdByName?: string | null
  reader?: string | Pick<UserProfile, 'id' | 'firstName' | 'middleName' | 'lastName'> | null
  createdBy?: string | Pick<UserProfile, 'id' | 'firstName' | 'middleName' | 'lastName'> | null
  meterReader?: string | Pick<UserProfile, 'id' | 'firstName' | 'middleName' | 'lastName'> | null
  recorder?: string | Pick<UserProfile, 'id' | 'firstName' | 'middleName' | 'lastName'> | null
  customer?: Pick<UserProfile, 'id' | 'accountNumber' | 'firstName' | 'lastName'>
  usageReview?: {
    onHold: boolean
    averageUnits?: number | null
    threshold?: number | null
    previousReadingsCount?: number
  }
}

export interface CreateReadingRequest {
  customerId: string
  currentReading: number
}

export interface UpdateReadingRequest {
  currentReading: number
}

export interface CreateUserRequest {
  firstName: string
  middleName: string | null
  lastName: string
  phoneNumber: string
  role: 'CONSUMER' | 'READER'
  accountNumber?: string
  location?: string
}

export interface ImportCustomersResult {
  imported: number
  skipped: number
  phoneWarnings: Array<string | { row?: number; message?: string }>
}
