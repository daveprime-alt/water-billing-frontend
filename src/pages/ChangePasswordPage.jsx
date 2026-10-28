import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { AlertCircle, ArrowRight, Home, LoaderCircle, ShieldCheck, Droplets } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { getMessage } from '../utils/formatters.js'
import { ErrorState, Field, PasswordInput } from '../components/ui/index.jsx'

export function ChangePasswordPage() {
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword)
  const roleClass = `role-${(user?.role || 'CONSUMER').toLowerCase()}`
  const schema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters').refine((value) => new TextEncoder().encode(value).length <= 72, 'Password must be no more than 72 UTF-8 bytes'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  }).refine((value) => value.newPassword === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
    .refine((value) => value.newPassword !== user?.phoneNumber, { path: ['newPassword'], message: 'Your password cannot be your phone number' })
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })
  const mutation = useMutation({
    mutationFn: (values) => api.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      toast.success('Password updated. Sign in again with your new password.')
      clearSession()
      navigate('/login', { replace: true })
    },
    onError: (error) => toast.error(getMessage(error)),
  })
  return (
    <div className={`auth-layout auth-layout-compact ${roleClass}`}>
      <section className="auth-panel">
        <Link to="/" className="brand auth-brand"><span className="brand-mark"><Droplets size={21} /></span><span><b>Cagnar Farm</b><small>Utility portal</small></span></Link>
        <div className="auth-content">
          <div className="eyebrow">ACCOUNT SECURITY</div><h1>{mustChangePassword ? 'Set a new password.' : 'Change your password.'}</h1><p className="auth-lede">{mustChangePassword ? 'Replace your temporary password to continue.' : 'Update your password whenever you need to keep your account secure.'}</p>
          {mustChangePassword
            ? <div className="notice notice-warning"><AlertCircle size={17} /><div><strong>Temporary password in use</strong><p>Your initial password is based on your phone number. Change it now and do not share it.</p></div></div>
            : <div className="notice notice-info"><ShieldCheck size={17} /><div><strong>Self-service password change</strong><p>You can change your password here without contacting an administrator. You will need to sign in again afterward.</p></div></div>}
          <form className="form-stack" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
            <Field label="Current password" error={errors.currentPassword?.message}><PasswordInput autoComplete="current-password" {...register('currentPassword')} /></Field>
            <Field label="New password" hint="At least 8 characters; maximum 72 UTF-8 bytes." error={errors.newPassword?.message}><PasswordInput autoComplete="new-password" {...register('newPassword')} /></Field>
            <Field label="Confirm new password" error={errors.confirmPassword?.message}><PasswordInput autoComplete="new-password" {...register('confirmPassword')} /></Field>
            <button className="button button-primary button-full" disabled={mutation.isPending}>{mutation.isPending ? <><LoaderCircle size={16} className="spin" /> Saving password</> : <>Update password <ArrowRight size={16} /></>}</button>
            {mustChangePassword && <Link className="button button-secondary button-full" to="/"><Home size={16} /> Back to home</Link>}
          </form>
          {mutation.error && <ErrorState error={mutation.error} />}
        </div>
        <div className="auth-footer"><span>© {new Date().getFullYear()} Cagnar Farm</span></div>
      </section>
      <aside className="auth-aside"><div className="auth-aside-inner"><span className="aside-kicker"><ShieldCheck size={15} /> ACCOUNT PROTECTION</span><h2>Make your account yours.</h2><p>Choose a unique password you do not use elsewhere. Your new password is never shown or logged by this app.</p></div><div className="aside-footer">Private by design</div></aside>
    </div>
  )
}
