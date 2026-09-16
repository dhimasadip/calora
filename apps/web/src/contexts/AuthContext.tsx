import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@calora/shared'
import { api } from '@/lib/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login(email: string, password: string): Promise<void>
  register(email: string, password: string, displayName: string): Promise<void>
  logout(): Promise<void>
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { try { setUser((await api<{ user: User }>('/auth/me', { suppressToast: true })).user) } catch { setUser(null) } }, [])
  const login = useCallback(async (email: string, password: string) => { setUser((await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } })).user) }, [])
  const register = useCallback(async (email: string, password: string, displayName: string) => { await api('/auth/register', { method: 'POST', body: { email, password, displayName } }) }, [])
  const logout = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setUser(null) } }, [])
  useEffect(() => { refresh().finally(() => setLoading(false)) }, [refresh])
  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
