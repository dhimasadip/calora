import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { PLAN_LABELS, type ChatUsage } from '@calora/shared'
import { PromoCodeForm } from '@/components/PromoCodeForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// planExpiresAt / resetAt are tz-naive Jakarta wall-clock strings (e.g. "2026-07-02T10:00:00").
// Display the date portion directly without re-converting timezones.
function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Profile() {
  const { user, refresh } = useAuth()
  const [usage, setUsage] = useState<ChatUsage | null>(null)

  const loadUsage = useCallback(() => {
    api<ChatUsage>('/agent/usage')
      .then(setUsage)
      .catch(() => setUsage(null))
  }, [])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  const isPro = user?.plan === 'pro'

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto w-full max-w-lg space-y-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">Profile</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <i className="ti ti-arrow-left mr-1" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your plan
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: isPro ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: isPro ? '#fff' : 'var(--color-text-secondary)',
                  border: isPro ? 'none' : '0.5px solid var(--color-border)',
                }}
              >
                {PLAN_LABELS[user?.plan ?? 'free']}
              </span>
            </CardTitle>
            <CardDescription>
              {isPro
                ? `Pro is active${user?.planExpiresAt ? ` until ${formatDate(user.planExpiresAt)}` : ''}.`
                : 'You are on the Free plan.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usage && (
              <div className="rounded-lg bg-muted p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chats used</span>
                  <span className="font-medium">
                    {usage.used} / {usage.limit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPro
                    ? `Up to ${usage.limit} messages every 6 hours.`
                    : `Up to ${usage.limit} messages per day (resets at midnight WIB).`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Have a promo code?</CardTitle>
            <CardDescription>Redeem a code to unlock or extend Pro.</CardDescription>
          </CardHeader>
          <CardContent>
            <PromoCodeForm
              onSuccess={() => {
                refresh()
                loadUsage()
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
