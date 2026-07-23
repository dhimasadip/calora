import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { formatInJakarta, toDateStr, type ReminderPreferences } from '@calora/shared'
import { useAuth } from '@/contexts/AuthContext'
import { caloraApi } from '@/lib/api'
import { CoachDrawer } from './CoachDrawer'
import { flushMutationQueue, hasFiredReminder, markReminderFired, pendingMutations } from '@/lib/offline'

const navItems = [{ to: '/', label: 'Today', icon: '☀' }, { to: '/insights', label: 'Insights', icon: '◔' }, { to: '/history', label: 'History', icon: '≡' }, { to: '/settings', label: 'Settings', icon: '⚙' }]

function jakartaTime() { return formatInJakarta(new Date(), { hour: '2-digit', minute: '2-digit', hour12: false }) }

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [coachOpen, setCoachOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [issueCount, setIssueCount] = useState(0)
  const [reminder, setReminder] = useState<string | null>(null)

  useEffect(() => {
    const refreshQueue = async () => { await flushMutationQueue(); const queued = await pendingMutations(); setIssueCount(queued.length) }
    const onlineHandler = () => { setOnline(true); void refreshQueue() }; const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler); window.addEventListener('offline', offlineHandler); void refreshQueue()
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler) }
  }, [])

  useEffect(() => {
    let preferences: ReminderPreferences | null = null
    void caloraApi.reminders().then((response) => { preferences = response.preferences }).catch(() => undefined)
    const check = async () => {
      if (!preferences) return
      const candidates: Array<[boolean, string, string]> = [[preferences.mealReminderEnabled, preferences.mealReminderTime, 'A gentle nudge: how did your meal go?'], [preferences.weightReminderEnabled, preferences.weightReminderTime, 'A quick weigh-in can help reveal your trend.']]
      for (const [enabled, time, message] of candidates) {
        const id = `${toDateStr()}-${time}-${message.slice(0, 5)}`
        if (enabled && jakartaTime() === time && !(await hasFiredReminder(id))) {
          await markReminderFired(id); setReminder(message)
          if (Notification.permission === 'granted') new Notification('Calora reminder', { body: message })
        }
      }
    }
    void check(); const timer = window.setInterval(() => void check(), 30_000); return () => window.clearInterval(timer)
  }, [])

  return <div className="app-shell"><aside className="desktop-nav"><NavLink to="/" className="brand">cal<span>ora</span></NavLink><p className="nav-greeting">Hello, {user?.displayName?.split(' ')[0] ?? 'there'}.</p><nav>{navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-item"><span>{item.icon}</span>{item.label}</NavLink>)}</nav><div className="nav-bottom"><button className="coach-trigger" onClick={() => setCoachOpen(true)}>✦ Ask your coach</button><button className="signout" onClick={() => void logout()}>Sign out</button></div></aside><header className="mobile-header"><NavLink to="/" className="brand">cal<span>ora</span></NavLink><button className="coach-trigger compact" onClick={() => setCoachOpen(true)}>✦ Coach</button></header>{reminder && <button className="reminder-banner" onClick={() => setReminder(null)}>{reminder}<span>×</span></button>}{!online && <div className="offline-banner">You’re offline. Manual changes will sync when you reconnect.</div>}{issueCount > 0 && <button className="sync-banner" onClick={() => navigate('/settings')}>{issueCount} change{issueCount === 1 ? '' : 's'} waiting to sync →</button>}<Outlet /><nav className="mobile-nav">{navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><span>{item.icon}</span><small>{item.label}</small></NavLink>)}</nav><CoachDrawer open={coachOpen} onClose={() => setCoachOpen(false)} /></div>
}
