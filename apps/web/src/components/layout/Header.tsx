import { Link } from 'react-router-dom'
import { formatInJakarta } from '@calora/shared'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

export function Header() {
  const { user, logout } = useAuth()
  const isPro = user?.plan === 'pro'
  const today = formatInJakarta(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })
  const initial = (user?.displayName?.trim()?.[0] ?? 'U').toUpperCase()

  return (
    <header
      className="flex items-center justify-between bg-card px-4"
      style={{ height: 44, borderBottom: '0.5px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        <h1
          style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}
        >
          Cal<span style={{ color: 'var(--color-primary)' }}>ora</span>
        </h1>
        <span
          className="hidden sm:inline"
          style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
        >
          {today}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="hidden sm:inline"
          style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
        >
          {user?.displayName}
        </span>
        {isPro && (
          <span
            className="rounded-full px-1.5"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: '#fff', background: 'var(--color-primary)', lineHeight: '16px' }}
            title="Pro plan"
          >
            PRO
          </span>
        )}
        <Link to="/profile" title="Profile & plan">
          <span
            className="flex items-center justify-center rounded-full text-white"
            style={{ width: 28, height: 28, fontSize: 11, fontWeight: 500, background: 'var(--color-primary)' }}
          >
            {initial}
          </span>
        </Link>
        <Button variant="ghost" size="icon" onClick={logout} title="Sign out" className="h-8 w-8">
          <i className="ti ti-logout" style={{ fontSize: 16, color: 'var(--color-text-secondary)' }} />
        </Button>
      </div>
    </header>
  )
}
