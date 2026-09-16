import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError, caloraApi } from '@/lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resending, setResending] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNeedsVerification(false)
    try {
      await login(email, password)
      navigate('/')
    } catch (caught) {
      const verificationRequired = caught instanceof ApiError && caught.status === 403 && Boolean((caught.details as { needsVerification?: boolean } | undefined)?.needsVerification)
      setNeedsVerification(verificationRequired)
      setError(verificationRequired ? 'Please verify your email before signing in. We sent a link to your inbox when you signed up.' : caught instanceof ApiError && caught.status === 401 ? 'The email or password is incorrect. Check both fields and try again.' : caught instanceof Error ? caught.message : 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (!email.trim() || resending) return
    setResending(true)
    try {
      await caloraApi.resendVerification(email)
      setResendSent(true)
    } finally {
      setResending(false)
    }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link className="brand" to="/">cal<span>ora</span></Link><p className="eyebrow">Welcome back</p><h1>Good to see you.</h1><p>Pick up your gentle rhythm right where you left it.</p><label className="field-wrap"><span className="field-label">Email</span><input className={`wellness-input ${error ? 'input-error' : ''}`} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); setResendSent(false) }} placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(error)} required /></label><label className="field-wrap"><span className="field-label">Password</span><input className={`wellness-input ${error ? 'input-error' : ''}`} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(null) }} placeholder="Enter your password" autoComplete="current-password" aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} required />{error && <span id="login-error" className="field-error" role="alert">{error}</span>}{needsVerification && <div className="auth-verify"><p>No email yet? Check your spam folder or get a fresh link.</p><button type="button" className="secondary-action" onClick={() => void resend()} disabled={resending || resendSent || !email.trim()}>{resendSent ? 'Verification email sent' : resending ? 'Sending…' : 'Resend verification email'}</button></div>}</label><button className="primary-action" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><p className="auth-switch">New here? <Link to="/register">Create a free account</Link></p></form></main>
}
