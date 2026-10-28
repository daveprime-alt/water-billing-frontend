import { FileText, Gauge, KeyRound, LayoutDashboard, MessageSquare, UserRound, Users } from 'lucide-react'

export const roleLabels = { ADMIN: 'Administrator', READER: 'Meter reader', CONSUMER: 'Customer' }

export const roleLinks = {
  ADMIN: [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/readings', label: 'Meter readings', icon: Gauge },
    { to: '/accounts', label: 'Accounts & import', icon: Users },
    { to: '/sms', label: 'SMS management', icon: MessageSquare },
    { to: '/profile', label: 'My profile', icon: UserRound },
  ],
  READER: [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/readings', label: 'Meter readings', icon: Gauge },
    { to: '/profile', label: 'My profile', icon: UserRound },
    { to: '/change-password', label: 'Change password', icon: KeyRound },
  ],
  CONSUMER: [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/invoices', label: 'My invoices', icon: FileText },
    { to: '/profile', label: 'My profile', icon: UserRound },
  ],
}
