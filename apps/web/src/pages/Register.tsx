import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'

type FieldErrors = { password?: string; confirm?: string }

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const passwordChecks = useMemo(() => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ], [password])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: FieldErrors = {}
    if (!passwordChecks.every((check) => check.met)) nextErrors.password = 'Your password must meet all four requirements.'
    if (password !== confirm) nextErrors.confirm = 'Passwords do not match.'
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return }
    setLoading(true)
    setErrors({})
    try {
      await register(email, password, name)
      navigate('/onboarding')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        const fields = (caught.details as { error?: Record<string, string[]> } | undefined)?.error
        setErrors({ password: fields?.password?.[0] })
      }
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link className="brand" to="/">cal<span>ora</span></Link><p className="eyebrow">A fresh start</p><h1>Make space for you.</h1><p>Free, private tracking that meets you in the real world.</p><label className="field-wrap"><span className="field-label">Your name</span><input className="wellness-input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label><label className="field-wrap"><span className="field-label">Email</span><input className="wellness-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label className="field-wrap"><span className="field-label">Password</span><input className={`wellness-input ${errors.password ? 'input-error' : ''}`} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-rules password-error' : 'password-rules'} required /><span id="password-rules" className="password-rules">{passwordChecks.map((check) => <span key={check.label} className={`password-rule ${check.met ? 'met' : ''}`}>{check.label}</span>)}</span>{errors.password && <span id="password-error" className="field-error" role="alert">{errors.password}</span>}</label><label className="field-wrap"><span className="field-label">Confirm password</span><input className={`wellness-input ${errors.confirm ? 'input-error' : ''}`} type="password" value={confirm} onChange={(event) => { setConfirm(event.target.value); setErrors((current) => ({ ...current, confirm: undefined })) }} autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'confirm-error' : undefined} required />{errors.confirm && <span id="confirm-error" className="field-error" role="alert">{errors.confirm}</span>}</label><button className="primary-action" disabled={loading}>{loading ? 'Creating account…' : 'Create free account'}</button><p className="auth-switch">Already use Calora? <Link to="/login">Sign in</Link></p></form></main>
}
