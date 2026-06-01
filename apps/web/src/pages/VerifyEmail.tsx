import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [error, setError] = useState<string | null>(null)
  // Guard against the effect running twice in React 18 StrictMode (which would burn the
  // single-use token on the first invisible call).
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) {
      setStatus('error')
      setError('This verification link is missing its token.')
      return
    }

    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Verification failed')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'verifying' && (
            <>
              <CardTitle className="text-2xl">Verifying your email…</CardTitle>
              <CardDescription>Hang tight while we confirm your account.</CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">✅</div>
              <CardTitle className="text-2xl">Email verified</CardTitle>
              <CardDescription>Your account is now active. Sign in to get started.</CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-2xl">⚠️</div>
              <CardTitle className="text-2xl">Verification failed</CardTitle>
              <CardDescription>{error ?? 'This verification link is invalid or has expired.'}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <Button asChild className="w-full">
              <Link to="/login">Continue to sign in</Link>
            </Button>
          )}
          {status === 'error' && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Verification links expire after 24 hours. You can request a new one from the sign-in page.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
