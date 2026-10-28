import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { Check, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { roleLabels } from '../config/navigation.js'
import { getMessage, nameOf } from '../utils/formatters.js'
import { ErrorState, Field, LoadingState, PageTitle } from '../components/ui/index.jsx'

export function ProfilePage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })
  const schema = z.object({
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().optional().nullable(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    location: z.string().optional().nullable(),
  })
  const profileValues = useMemo(() => profileQuery.data ? {
    firstName: profileQuery.data.firstName || '',
    middleName: profileQuery.data.middleName || '',
    lastName: profileQuery.data.lastName || '',
    location: profileQuery.data.location || '',
  } : undefined, [profileQuery.data])
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(schema), values: profileValues })
  const updateMutation = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => { toast.success('Profile updated.'); queryClient.invalidateQueries({ queryKey: ['profile'] }) },
    onError: (error) => toast.error(getMessage(error)),
  })
  return <>
    <PageTitle eyebrow="ACCOUNT / PROFILE" title="My profile" description="Manage the personal details associated with your utility account." />
    <div className="bento-grid profile-grid">
      <section className="bento-card span-3 profile-main">
        <div className="card-heading"><div><div className="eyebrow">PERSONAL INFORMATION</div><h3>Account details</h3></div><span className="icon-tile"><UserRound size={17} /></span></div>
        {profileQuery.isLoading ? <LoadingState label="Loading your profile" /> : profileQuery.error ? <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} /> :
          <form className="form-grid" onSubmit={handleSubmit((values) => updateMutation.mutate({ ...values, middleName: values.middleName || null, location: values.location || null }))} noValidate>
            <Field label="First name" error={errors.firstName?.message}><input autoComplete="given-name" {...register('firstName')} /></Field>
            <Field label="Middle name" error={errors.middleName?.message}><input autoComplete="additional-name" {...register('middleName')} /></Field>
            <Field label="Last name" error={errors.lastName?.message}><input autoComplete="family-name" {...register('lastName')} /></Field>
            <Field label="Service location" error={errors.location?.message}><input {...register('location')} /></Field>
            <Field label="Phone number" hint="Managed by your utility administrator"><input value={profileQuery.data?.phoneNumber || ''} disabled /></Field>
            <Field label="Account number" hint="Read-only account identifier"><input value={profileQuery.data?.accountNumber || ''} disabled /></Field>
            <div className="form-submit"><button className="button button-primary" disabled={!isDirty || updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save profile changes'} <Check size={15} /></button></div>
            {updateMutation.error && <ErrorState error={updateMutation.error} />}
          </form>}
      </section>
      <aside className="bento-card span-1 profile-side">
        <div className="eyebrow">ACCOUNT ACCESS</div><span className="profile-avatar-large">{user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}</span><h3>{nameOf(profileQuery.data || user)}</h3><span className="role-chip">{roleLabels[user.role]}</span>
        <div className="summary-divider" />
        <div className="summary-row"><span>Phone</span><b>{profileQuery.data?.phoneNumber || user.phoneNumber || '—'}</b></div>
        <div className="summary-row"><span>Account</span><b>{profileQuery.data?.accountNumber || user.accountNumber || '—'}</b></div>
        <p className="profile-security-note"><ShieldCheck size={15} /> Phone number, role, and account number are read-only. Contact an administrator to change them.</p>
      </aside>
      <section className="bento-card span-2 security-card"><span className="notice-mark"><ShieldCheck size={19} /></span><div><div className="eyebrow">PASSWORD & ACCESS</div><h3>Keep your account secure</h3><p>Change your password yourself at any time. You will need to sign in again after it is updated.</p><Link to="/change-password" className="text-link">Change password</Link></div></section>
    </div>
  </>
}
