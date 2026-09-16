import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { caloraApi } from '@/lib/api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) {
      setError('This verification link is missing its token. Request a new one from the sign-in page.')
      return
    }
    caloraApi.verifyEmail(token)
      .then(async () => { await refresh().catch(() => undefined); navigate('/onboarding', { replace: true }) })
      .catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : 'Could not verify your email. Please try again.') })
  }, [token, navigate, refresh])

  return <main className="auth-page"><section className="auth-card"><Link className="brand" to="/">cal<span>ora</span></Link><p className="eyebrow">Email verification</p><h1>{error ? 'That link didn’t work.' : 'Checking your link…'}</h1>{error ? <><p>{error}</p><p className="auth-switch">Need a fresh link? <Link to="/login">Go to sign in</Link> to resend it.</p></> : <p>One moment while we verify your email.</p>}</section></main>
}
