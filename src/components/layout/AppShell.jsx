import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleHelp, Droplets, KeyRound, LogOut, Menu, MoreHorizontal, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../services/api.js'
import { roleLabels, roleLinks } from '../../config/navigation.js'
import { useAuthStore } from '../../stores/authStore.js'
import { getMessage, nameOf } from '../../utils/formatters.js'
import { LoadingState, NotFoundPage } from '../ui/index.jsx'

const Dashboard = lazy(() => import('../dashboard/Dashboard.jsx').then(({ Dashboard: page }) => ({ default: page })))
const AccountsPage = lazy(() => import('../../pages/AccountsPage.jsx').then(({ AccountsPage: page }) => ({ default: page })))
const InvoicesPage = lazy(() => import('../../pages/InvoicesPage.jsx').then(({ InvoicesPage: page }) => ({ default: page })))
const ProfilePage = lazy(() => import('../../pages/ProfilePage.jsx').then(({ ProfilePage: page }) => ({ default: page })))
const ReadingsPage = lazy(() => import('../../pages/ReadingsPage.jsx').then(({ ReadingsPage: page }) => ({ default: page })))
const SmsManagementPage = lazy(() => import('../../pages/SmsManagementPage.jsx').then(({ SmsManagementPage: page }) => ({ default: page })))

export function AppShell() {
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [topbarProfileOpen, setTopbarProfileOpen] = useState(false)
  const topbarProfileRef = useRef(null)
  const queryClient = useQueryClient()
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => toast.success('You have been signed out.'),
    onError: (error) => toast.error(`Signed out locally. ${getMessage(error)}`),
    onSettled: () => {
      clearSession()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
  const activeRole = user?.role || 'CONSUMER'
  const roleClass = `role-${activeRole.toLowerCase()}`
  const pageLabel = roleLinks[activeRole]?.find((item) => item.to === location.pathname)?.label || 'Overview'

  useEffect(() => {
    if (!topbarProfileOpen) return undefined

    const handlePointerDown = (event) => {
      if (!topbarProfileRef.current?.contains(event.target)) setTopbarProfileOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTopbarProfileOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [topbarProfileOpen])

  return (
    <div className={`app-shell ${roleClass}`}>
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <Link to="/" className="brand" aria-label="Cagnar Farm home">
          <span className="brand-mark"><Droplets size={21} /></span>
          <span><b>Cagnar Farm</b><small>Utility portal</small></span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {roleLinks[activeRole].map(({ to, label, icon: Icon }) => (
            <NavLink end={to === '/'} key={to} to={to} onClick={() => { setMobileNavOpen(false); setProfileMenuOpen(false) }} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {activeRole !== 'ADMIN' && <div className="support-card">
            <div className="support-icon"><CircleHelp size={16} /></div>
            <b>Need a hand?</b>
            <span>Contact your utility administrator for account support.</span>
          </div>}
          <button className="account-switcher" onClick={() => setProfileMenuOpen((value) => !value)}>
            <span className="avatar">{user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}</span>
            <span className="account-identity"><b>{nameOf(user)}</b><small>{roleLabels[activeRole]}</small></span>
            <MoreHorizontal size={18} />
          </button>
          {profileMenuOpen && <div className="profile-popover"><NavLink to="/profile" onClick={() => setProfileMenuOpen(false)}><Settings2 size={15} /> Profile settings</NavLink><button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
            <span className="breadcrumbs">Workspace <span>/</span> {pageLabel}</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-profile" ref={topbarProfileRef}>
              <button
                className="topbar-user"
                onClick={() => setTopbarProfileOpen((open) => !open)}
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={topbarProfileOpen}
              >
                <span className="avatar avatar-small">{user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}</span>
              </button>
              {topbarProfileOpen && <div className="topbar-profile-menu" role="menu" aria-label="Account menu">
                <div className="topbar-profile-details">
                  <b>{nameOf(user)}</b>
                  <span>{roleLabels[activeRole]}</span>
                  {user?.phoneNumber && <small>{user.phoneNumber}</small>}
                  {user?.accountNumber && <small>Account {user.accountNumber}</small>}
                </div>
                <NavLink role="menuitem" to="/profile" onClick={() => setTopbarProfileOpen(false)}><Settings2 size={15} /> Profile settings</NavLink>
                <NavLink role="menuitem" to="/change-password" onClick={() => setTopbarProfileOpen(false)}><KeyRound size={15} /> Change password</NavLink>
                <button role="menuitem" onClick={() => { setTopbarProfileOpen(false); logoutMutation.mutate() }} disabled={logoutMutation.isPending}><LogOut size={15} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="content-wrap">
          <Suspense fallback={<LoadingState label="Loading workspace" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/invoices" element={<RoleGate roles={['ADMIN', 'CONSUMER']}><InvoicesPage /></RoleGate>} />
              <Route path="/readings" element={<RoleGate roles={['ADMIN', 'READER']}><ReadingsPage /></RoleGate>} />
              <Route path="/accounts" element={<RoleGate roles={['ADMIN']}><AccountsPage /></RoleGate>} />
              <Route path="/sms" element={<RoleGate roles={['ADMIN']}><SmsManagementPage /></RoleGate>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export function RoleGate({ children, roles }) {
  const user = useAuthStore((state) => state.user)
  return roles.includes(user.role) ? children : <Navigate to="/" replace />
}
