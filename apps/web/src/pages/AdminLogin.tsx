import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { ApiError } from '@/lib/api'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/admin')
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? 'The email or password is incorrect. Check both fields and try again.' : caught instanceof Error ? caught.message : 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Link className="brand" to="/">cal<span>ora</span></Link><p className="eyebrow">Administration</p><h1>Usage at a glance.</h1><p>AI token and cost accounting across every member.</p><label className="field-wrap"><span className="field-label">Email</span><input className={`wellness-input ${error ? 'input-error' : ''}`} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(null) }} placeholder="admin@example.com" autoComplete="email" aria-invalid={Boolean(error)} required /></label><label className="field-wrap"><span className="field-label">Password</span><input className={`wellness-input ${error ? 'input-error' : ''}`} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(null) }} placeholder="Enter the admin password" autoComplete="current-password" aria-invalid={Boolean(error)} aria-describedby={error ? 'admin-login-error' : undefined} required />{error && <span id="admin-login-error" className="field-error" role="alert">{error}</span>}</label><button className="primary-action" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><p className="auth-switch"><Link to="/">Back to Calora</Link></p></form></main>
}
