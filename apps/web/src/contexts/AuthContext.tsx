import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'

interface AuthUser {
  id: string
  email: string
  displayName: string
  onboardingComplete: boolean
  plan: 'free' | 'pro'
  planExpiresAt: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser }>('/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setUser(data.user)
  }, [])

  // Registration no longer authenticates — the account stays unverified until the user
  // clicks the email link, so we don't set the user here.
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    await api('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    })
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    await api('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, resendVerification, logout, refresh }),
    [user, loading, login, register, resendVerification, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
