import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { adminApi } from '@/lib/api'

interface AdminAuthContextValue {
  admin: boolean
  loading: boolean
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const login = useCallback(async (email: string, password: string) => { await adminApi.login(email, password); setAdmin(true) }, [])
  const logout = useCallback(async () => { try { await adminApi.logout() } finally { setAdmin(false) } }, [])
  useEffect(() => { adminApi.me().then(() => setAdmin(true)).catch(() => setAdmin(false)).finally(() => setLoading(false)) }, [])
  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading, login, logout])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return context
}
