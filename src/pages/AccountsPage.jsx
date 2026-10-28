import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { AlertCircle, ArrowRight, Check, Plus, Search, ShieldCheck, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api.js'
import { getMessage } from '../utils/formatters.js'
import { ConfirmDialog, ErrorState, Field, PageTitle } from '../components/ui/index.jsx'
import { UserDirectorySearch } from '../components/accounts/UserDirectorySearch.jsx'

export function AccountsPage() {
  const [activeTab, setActiveTab] = useState('create')
  const [createdAccount, setCreatedAccount] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [userId, setUserId] = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [resetConfirmation, setResetConfirmation] = useState(false)
  const [phoneConfirmation, setPhoneConfirmation] = useState(false)
  const [removePhoneTarget, setRemovePhoneTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()
  const createSchema = z.object({
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().optional(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    phoneNumber: z.string().trim().min(1, 'Phone number is required').regex(/^(?:\+?254|0)(?:7|1)\d{8}$/, 'Enter a valid Kenyan mobile number'),
    role: z.enum(['CONSUMER', 'READER']),
    accountNumber: z.string().trim().optional(),
    location: z.string().optional(),
  }).refine((values) => values.role === 'READER' || Boolean(values.accountNumber), {
    path: ['accountNumber'],
    message: 'Account number is required',
  })
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({ resolver: zodResolver(createSchema), defaultValues: { role: 'CONSUMER' } })
  const selectedRole = useWatch({ control, name: 'role' })
  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: (result) => { setCreatedAccount(result); toast.success('Account created.'); reset({ role: 'CONSUMER' }) },
    onError: (error) => toast.error(getMessage(error)),
  })
  const importMutation = useMutation({
    mutationFn: api.importCustomers,
    onSuccess: (result) => { toast.success('Import completed.'); setUploadFile(null); queryClient.invalidateQueries({ queryKey: ['invoices'] }); setImportResult(result) },
    onError: (error) => toast.error(getMessage(error)),
  })
  const [importResult, setImportResult] = useState(null)
  const resetMutation = useMutation({
    mutationFn: (id) => api.resetUserPassword(id),
    onSuccess: (result) => { toast.success(result?.message || 'Temporary password reset. Verify the user outside the app.'); setResetConfirmation(false) },
    onError: (error) => { toast.error(getMessage(error)); setResetConfirmation(false) },
  })
  const phoneSchema = z.object({ phoneNumber: z.string().trim().regex(/^(?:\+?254|0)(?:7|1)\d{8}$/, 'Enter a valid Kenyan mobile number') })
  const { register: registerPhone, handleSubmit: handlePhoneSubmit, formState: { errors: phoneErrors }, reset: resetPhone } = useForm({ resolver: zodResolver(phoneSchema) })
  const phoneMutation = useMutation({
    mutationFn: ({ id, values }) => api.updateUserPhone(id, values),
    onSuccess: (result) => {
      toast.success(result?.message || 'Phone updated; temporary password reset.')
      setPhoneConfirmation(false)
      resetPhone()
      queryClient.invalidateQueries({ queryKey: ['user-directory'] })
      queryClient.invalidateQueries({ queryKey: ['user-directory-all-consumers'] })
    },
    onError: (error) => { toast.error(getMessage(error)); setPhoneConfirmation(false) },
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: (result) => {
      toast.success(result?.message || 'Account deleted.')
      setDeleteTarget(null)
      if (userId === deleteTarget?.id) setUserId('')
      if (phoneId === deleteTarget?.id) setPhoneId('')
      queryClient.invalidateQueries({ queryKey: ['user-directory'] })
      queryClient.invalidateQueries({ queryKey: ['user-directory-all-consumers'] })
    },
    onError: (error) => toast.error(getMessage(error)),
  })
  const removePhoneMutation = useMutation({
    mutationFn: api.deleteUserPhone,
    onSuccess: (result) => {
      toast.success(result?.message || 'Phone number removed.')
      setRemovePhoneTarget(null)
      queryClient.invalidateQueries({ queryKey: ['user-directory'] })
      queryClient.invalidateQueries({ queryKey: ['user-directory-all-consumers'] })
    },
    onError: (error) => {
      toast.error(getMessage(error))
      setRemovePhoneTarget(null)
    },
  })

  return <>
    <PageTitle eyebrow="ADMINISTRATION / ACCOUNTS" title="Accounts & import" description="Provision customer and reader access, or import customer records." />
    <div className="bento-grid accounts-grid">
      <section className="bento-card span-3 account-workspace">
        <div className="tab-list" role="tablist" aria-label="Account administration">
          <button role="tab" aria-selected={activeTab === 'create'} className={activeTab === 'create' ? 'selected' : ''} onClick={() => setActiveTab('create')}><Plus size={15} /> Create account</button>
          <button role="tab" aria-selected={activeTab === 'import'} className={activeTab === 'import' ? 'selected' : ''} onClick={() => setActiveTab('import')}><Upload size={15} /> Import customers</button>
          <button role="tab" aria-selected={activeTab === 'directory'} className={activeTab === 'directory' ? 'selected' : ''} onClick={() => setActiveTab('directory')}><Search size={15} /> User directory</button>
          <button role="tab" aria-selected={activeTab === 'security'} className={activeTab === 'security' ? 'selected' : ''} onClick={() => setActiveTab('security')}><ShieldCheck size={15} /> Account security</button>
        </div>
        {activeTab === 'create' && <div className="tab-content">
          <div className="eyebrow">NEW USER</div><h3>Create an account</h3><p className="section-description">Create a consumer or reader account. Admin accounts cannot be created through this endpoint.</p>
          {createdAccount && <div className="notice notice-success"><Check size={17} /><div><strong>Account created</strong><p>{createdAccount.message || 'Share the initial password only through a verified channel. The user must change it immediately.'}</p></div></div>}
          <div className="notice notice-warning"><AlertCircle size={17} /><div><strong>Temporary password</strong><p>The initial password is the normalized phone number. Communicate it only through a verified channel and tell the user to change it immediately.</p></div></div>
          <form className="form-grid" onSubmit={handleSubmit((values) => {
            setCreatedAccount(null)
            const user = {
              firstName: values.firstName,
              middleName: values.middleName || null,
              lastName: values.lastName,
              phoneNumber: values.phoneNumber,
              role: values.role,
              ...(values.role === 'CONSUMER' ? {
                accountNumber: values.accountNumber,
                ...(values.location?.trim() ? { location: values.location.trim() } : {}),
              } : {}),
            }
            createMutation.mutate(user)
          })} noValidate>
            <Field label="First name" error={errors.firstName?.message}><input {...register('firstName')} autoComplete="given-name" /></Field>
            <Field label="Middle name" error={errors.middleName?.message}><input {...register('middleName')} autoComplete="additional-name" /></Field>
            <Field label="Last name" error={errors.lastName?.message}><input {...register('lastName')} autoComplete="family-name" /></Field>
            <Field label="Phone number" hint="Kenyan mobile number" error={errors.phoneNumber?.message}><input inputMode="tel" placeholder="0712 345 678" {...register('phoneNumber')} /></Field>
            <Field label="Role" error={errors.role?.message}><select {...register('role')}><option value="CONSUMER">Consumer</option><option value="READER">Meter reader</option></select></Field>
            {selectedRole === 'CONSUMER' && <>
              <div className="account-number-field">
                <small className="field-hint">Format example: WTR-KAK-611AE3D4</small>
                <Field label="Account number" hint="Required. Follow the same format as existing accounts." error={errors.accountNumber?.message}><input placeholder="WTR-KAK-611AE3D4" autoComplete="off" {...register('accountNumber')} /></Field>
              </div>
              <Field label="Service location" hint="Optional" error={errors.location?.message}><input {...register('location')} /></Field>
            </>}
            <div className="form-submit"><button className="button button-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create account'} <ArrowRight size={15} /></button></div>
          </form>
          {createMutation.error && <ErrorState error={createMutation.error} />}
        </div>}
        {activeTab === 'import' && <div className="tab-content">
          <div className="eyebrow">BULK OPERATIONS</div><h3>Import customer records</h3><p className="section-description">Upload a spreadsheet or CSV. The file is sent as multipart form data and processed by the utility API.</p>
          <label className={`upload-zone ${uploadFile ? 'has-file' : ''}`} htmlFor="customer-import"><input id="customer-import" type="file" accept=".xls,.xlsx,.xlsm,.csv" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /><span className="upload-icon"><Upload size={20} /></span><b>{uploadFile ? uploadFile.name : 'Choose a file or browse'}</b><small>{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : 'Excel (.xls, .xlsx, .xlsm) or CSV · maximum 10 MB'}</small></label>
          {uploadFile && uploadFile.size > 10 * 1024 * 1024 && <div className="field-error-text">File exceeds the 10 MB limit.</div>}
          {importResult && <div className="import-result"><div><span>Imported</span><b>{importResult.imported ?? importResult.importedCount ?? 0}</b></div><div><span>Skipped</span><b>{importResult.skipped ?? importResult.skippedCount ?? 0}</b></div><div className="import-warnings"><span>Phone warnings</span><b>{Array.isArray(importResult.phoneWarnings) ? importResult.phoneWarnings.length : importResult.phoneWarnings ?? '—'}</b></div></div>}
          {importResult?.phoneWarnings && Array.isArray(importResult.phoneWarnings) && <div className="notice notice-warning"><AlertCircle size={17} /><div><strong>Phone number warnings</strong><ul>{importResult.phoneWarnings.map((warning, index) => <li key={index}>{typeof warning === 'string' ? warning : JSON.stringify(warning)}</li>)}</ul></div></div>}
          <div className="modal-actions"><button className="button button-primary" disabled={!uploadFile || uploadFile.size > 10 * 1024 * 1024 || importMutation.isPending} onClick={() => importMutation.mutate(uploadFile)}>{importMutation.isPending ? 'Uploading…' : 'Upload and import'} <ArrowRight size={15} /></button></div>
          {importMutation.error && <ErrorState error={importMutation.error} />}
        </div>}
        {activeTab === 'directory' && <div className="tab-content">
          <div className="eyebrow">USER DIRECTORY</div><h3>All user accounts</h3>
          <p className="section-description">Browse all users or search by name, account number, or phone. Add, edit, or remove a user’s phone number, manage account security, or delete an account.</p>
          <UserDirectorySearch
            onSelect={(account) => {
              setUserId(account.id)
              setPhoneId(account.id)
            }}
            onResetPassword={(account) => {
              setUserId(account.id)
              setResetConfirmation(true)
            }}
            onPhoneUpdate={(account) => {
              setPhoneId(account.id)
              setActiveTab('security')
            }}
            onPhoneRemove={(account) => setRemovePhoneTarget(account)}
            onDelete={(account) => setDeleteTarget(account)}
            selectedId={userId}
          />
          {userId && <div className="directory-selection"><span>Selected user ID: <b>{userId}</b></span><button className="button button-small button-secondary" onClick={() => setActiveTab('security')}>Manage account security</button></div>}
        </div>}
        {activeTab === 'security' && <div className="tab-content">
          <div className="eyebrow">CREDENTIAL MANAGEMENT</div><h3>Reset account access</h3><p className="section-description">Select a user in the directory or enter a known user ID.</p>
          <div className="notice notice-warning"><AlertCircle size={17} /><div><strong>Verify identity outside the app</strong><p>A reset sets the temporary password to the user's normalized phone number. Confirm their identity through a trusted channel before proceeding.</p></div></div>
          <div className="form-grid">
            <Field label="User ID to reset"><input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Enter a known user ID" /></Field>
            <div className="form-submit"><button className="button button-danger" disabled={!userId.trim()} onClick={() => setResetConfirmation(true)}>Reset temporary password</button></div>
          </div>
          <div className="section-separator" />
          <h3>Add or edit a user phone number</h3><p className="section-description">This sets or replaces the user's phone number and resets their temporary password to the new normalized number.</p>
          <form className="form-grid" onSubmit={handlePhoneSubmit(() => setPhoneConfirmation(true))} noValidate>
            <Field label="User ID" error={!phoneId && phoneConfirmation ? 'Enter a user ID' : undefined}><input value={phoneId} onChange={(event) => setPhoneId(event.target.value)} placeholder="Enter a known user ID" /></Field>
            <Field label="Phone number" hint="Kenyan mobile number" error={phoneErrors.phoneNumber?.message}><input inputMode="tel" placeholder="0712 345 678" {...registerPhone('phoneNumber')} /></Field>
            <div className="form-submit"><button className="button button-secondary" type="submit">Review phone number</button></div>
          </form>
        </div>}
      </section>
      <aside className="bento-card span-1 account-aside">
        <div className="eyebrow">ACCOUNT MANAGEMENT</div><span className="directory-icon"><Users size={21} /></span><h3>Accounts in one place</h3><p>Search the directory to find an account, or provision new consumers and readers from this workspace.</p>
        <div className="gap-list"><span><Check size={14} /> Search by name, account, or phone</span><span><Check size={14} /> Filter by role</span><span><Check size={14} /> Reset or update account access</span><span><Check size={14} /> Import customer spreadsheet</span></div>
      </aside>
    </div>
    {resetConfirmation && <ConfirmDialog title="Reset this user's password?" description={`Reset temporary password for user ${userId}. Verify the user's identity outside the app first.`} confirmLabel="Reset password" danger busy={resetMutation.isPending} onClose={() => setResetConfirmation(false)} onConfirm={() => resetMutation.mutate(userId)} />}
    {phoneConfirmation && <ConfirmDialog title="Add or update this phone number?" description={`Add or update the phone number for user ${phoneId}? The API also resets their temporary password to the normalized new number. Verify their identity first.`} confirmLabel="Save phone number" danger busy={phoneMutation.isPending} onClose={() => setPhoneConfirmation(false)} onConfirm={handlePhoneSubmit((values) => { if (!phoneId.trim()) return; phoneMutation.mutate({ id: phoneId.trim(), values }) })} />}
    {removePhoneTarget && <ConfirmDialog title="Remove this phone number?" description={`Remove the phone number from ${[removePhoneTarget.firstName, removePhoneTarget.lastName].filter(Boolean).join(' ') || 'this account'} (${removePhoneTarget.accountNumber || removePhoneTarget.id})? They may no longer be able to sign in or receive account messages until another number is added.`} confirmLabel="Remove phone number" danger busy={removePhoneMutation.isPending} onClose={() => setRemovePhoneTarget(null)} onConfirm={() => removePhoneMutation.mutate(removePhoneTarget.id)} />}
    {deleteTarget && <ConfirmDialog title="Delete this account?" description={`Permanently delete ${[deleteTarget.firstName, deleteTarget.lastName].filter(Boolean).join(' ') || 'this account'} (${deleteTarget.accountNumber || deleteTarget.id})? This cannot be undone. Accounts with billing or reading history may be protected by the server and cannot be deleted.`} confirmLabel="Delete account" danger busy={deleteMutation.isPending} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)} />}
  </>
}
