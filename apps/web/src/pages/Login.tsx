import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const { login, resendVerification } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setResendState('idle')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError && (err.details as { code?: string })?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true)
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendState('sending')
    try {
      await resendVerification(email)
    } finally {
      // Always show "sent" — the endpoint intentionally doesn't reveal whether the email exists.
      setResendState('sent')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Cal<span className="text-primary">ora</span></CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {needsVerification && (
              <div className="rounded-md border border-input bg-muted/40 p-3 text-sm space-y-2">
                {resendState === 'sent' ? (
                  <p className="text-muted-foreground">
                    If an unverified account exists for that email, a new verification link is on its way.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground">Need a new verification link?</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={resendState === 'sending'}
                      onClick={handleResend}
                    >
                      {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                    </Button>
                  </>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account?{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">Sign up</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
