import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { ArrowRight, Droplets, LoaderCircle, ShieldCheck } from 'lucide-react'
import { api, } from '../services/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { getMessage } from '../utils/formatters.js'
import { notifyError } from '../utils/notifications.js'
import { PasswordInput } from '../components/ui/index.jsx'

export function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()
  const schema = z.object({
    phoneNumber: z.string().trim().min(1, 'Enter your phone number'),
    password: z.string().min(1, 'Enter your password'),
  })
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phoneNumber: '', password: '' },
  })
  const mutation = useMutation({
    mutationFn: (values) => api.login(values),
    onSuccess: (result) => {
      login(result)
      if (result.mustChangePassword) navigate('/change-password', { replace: true })
      else navigate('/', { replace: true })
    },
    onError: (error) => notifyError(getMessage(error)),
  })
  return (
    <main className="grid min-h-screen grid-cols-1 grid-rows-[1fr_auto] bg-white md:grid-cols-[1.1fr_0.9fr]">
      <section className="flex min-h-[620px] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-[clamp(2rem,6vw,5.25rem)]">
        <Link to="/login" className="flex h-auto w-fit items-center gap-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600">
          <span className="grid size-12 place-items-center rounded-[11px] bg-sky-100 text-sky-700">
            <Droplets size={26} aria-hidden="true" />
          </span>
          <span>
            <b className="block font-['Manrope',sans-serif] text-[19px] leading-tight tracking-[-0.03em]">Cagnar Farm</b>
            <small className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Utility portal</small>
          </span>
        </Link>
        <div className="my-auto w-full self-center py-10 lg:max-w-[440px]">
          <h1 className="login-title-enter text-balance text-center font-['Manrope',sans-serif] text-[clamp(2.125rem,7vw,3.375rem)] font-bold leading-[1.12] tracking-[-0.045em] text-slate-900">
            Every drop counts
          </h1>
          <p className="mx-auto mb-7 mt-3 max-w-[34ch] text-center text-[clamp(0.875rem,2vw,1rem)] leading-relaxed text-slate-600">
            Sign in to manage your water account and billing.
          </p>
          <form className="grid gap-5" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
            <div className="grid gap-2">
              <label htmlFor="login-phone" className="text-sm font-semibold text-slate-700">Phone number</label>
              <input
                id="login-phone"
                autoComplete="username"
                inputMode="tel"
                placeholder="0712 345 678"
                aria-invalid={Boolean(errors.phoneNumber)}
                aria-describedby={errors.phoneNumber ? 'login-phone-error' : undefined}
                className={`h-[50px] w-full rounded-md border bg-white px-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.phoneNumber ? 'border-red-500' : 'border-slate-300'}`}
                {...register('phoneNumber')}
              />
              {errors.phoneNumber && <p id="login-phone-error" role="alert" className="text-sm text-red-700">{errors.phoneNumber.message}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">Password</label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                className={`h-[50px] w-full rounded-md border bg-white px-3 pr-12 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.password ? 'border-red-500' : 'border-slate-300'}`}
                {...register('password')}
              />
              {errors.password && <p id="login-password-error" role="alert" className="text-sm text-red-700">{errors.password.message}</p>}
            </div>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-600">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
              Access is provisioned by your utility administrator. There is no public sign-up.
            </p>
            <button
              className="inline-flex min-h-[49px] w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <><LoaderCircle size={17} className="animate-spin" /> Signing in</> : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
        </div>
      </section>
      <aside className="login-aside-panel grid min-h-[230px] place-items-center bg-[#123b51] px-6 py-9 text-white sm:px-8 md:min-h-0 md:px-[clamp(2rem,6vw,4.875rem)] md:py-12 max-[413px]:hidden" aria-label="About the utility portal">
        <div className="login-aside-enter relative z-10 max-w-[440px]">
          <h2 className="mb-3.5 text-balance font-['Manrope',sans-serif] text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.18] tracking-[-0.04em]">
            Your water account, clearly managed.
          </h2>
          <p className="max-w-[38ch] text-[clamp(0.9375rem,1.5vw,1.125rem)] leading-[1.7] text-sky-100">
            View billing, follow meter readings, and keep your account information up to date in one place.
          </p>
        </div>
      </aside>
      <footer className="col-span-full flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-5 py-4 text-center text-[11px] leading-relaxed text-slate-600 sm:justify-between sm:px-8 lg:px-[clamp(2rem,5vw,4.25rem)] max-[413px]:hidden">
        <span>© {new Date().getFullYear()} Cagnar Farm</span>
        <span>All rights reserved</span>
        <span>For account assistance, contact +254732579238.</span>
      </footer>
    </main>
  )
}
