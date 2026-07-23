import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/app/AppShell'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Insights from '@/pages/Insights'
import History from '@/pages/History'
import Settings from '@/pages/Settings'
import Privacy from '@/pages/Privacy'

function Protected({ children, onboarding = true }: { children: React.ReactNode; onboarding?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Preparing your Calora space…</div>
  if (!user) return <Navigate to="/login" replace />
  if (onboarding && !user.onboardingComplete) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function Public({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Preparing your Calora space…</div>
  if (user) return <Navigate to={user.onboardingComplete ? '/' : '/onboarding'} replace />
  return <>{children}</>
}

export default function App() { return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<Public><Login /></Public>} /><Route path="/register" element={<Public><Register /></Public>} /><Route path="/onboarding" element={<Protected onboarding={false}><Onboarding /></Protected>} /><Route path="/privacy" element={<Privacy />} /><Route element={<Protected><AppShell /></Protected>}><Route path="/" element={<Dashboard />} /><Route path="/insights" element={<Insights />} /><Route path="/history" element={<History />} /><Route path="/settings" element={<Settings />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter></AuthProvider> }
