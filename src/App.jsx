import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { AppShell } from './components/layout/AppShell.jsx'
import { useAuthStore } from './stores/authStore.js'
import { api } from './services/api.js'
import { getMessage } from './utils/formatters.js'
import './App.css'

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000

const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx').then(({ ChangePasswordPage: page }) => ({ default: page })))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx').then(({ LoginPage: page }) => ({ default: page })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAuth({ children }) {
  const user = useAuthStore((state) => state.user)
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword)
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return children
}

function AuthRouter() {
  const user = useAuthStore((state) => state.user)
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword)

  useEffect(() => {
    const handleExpiredSession = () => toast.error('Your session expired. Please sign in again.')
    window.addEventListener('water-billing:unauthorized', handleExpiredSession)
    return () => window.removeEventListener('water-billing:unauthorized', handleExpiredSession)
  }, [])

  if (user && mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
      <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
    </Routes>
  )
}

function SessionInactivityGuard({ children }) {
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return undefined

    let lastActivityAt = Date.now()
    let timeoutId
    let signedOut = false

    const signOutForInactivity = () => {
      if (signedOut) return
      signedOut = true
      const logoutRequest = api.logout()
      clearSession()
      queryClient.clear()
      navigate('/login', { replace: true })
      toast.info('You were signed out after 10 minutes of inactivity.')
      void logoutRequest.catch((error) => {
        toast.warning(`Signed out locally, but the server session could not be revoked. ${getMessage(error)}`)
      })
    }

    const checkInactivity = () => {
      const remainingTime = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt)
      if (remainingTime <= 0) {
        signOutForInactivity()
        return
      }

      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(checkInactivity, remainingTime)
    }

    const handleActivity = (event) => {
      const now = Date.now()
      if (now - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        signOutForInactivity()
        return
      }
      if (event.type === 'mousemove' && now - lastActivityAt < 1000) return

      lastActivityAt = now
      checkInactivity()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkInactivity()
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }))
    window.addEventListener('focus', checkInactivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    checkInactivity()

    return () => {
      window.clearTimeout(timeoutId)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity))
      window.removeEventListener('focus', checkInactivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearSession, navigate, queryClient, user])

  return children
}

function App() {
  const user = useAuthStore((state) => state.user)
  const toastRole = user?.role?.toLowerCase() || 'consumer'

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          theme="light"
          className={`app-toaster role-${toastRole}`}
          closeButton
        />
        <Suspense fallback={<main className="auth-loading" role="status">Loading portal…</main>}>
          <SessionInactivityGuard>
            <AuthRouter />
          </SessionInactivityGuard>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
