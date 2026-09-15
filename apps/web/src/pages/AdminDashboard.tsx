import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatInJakarta } from '@calora/shared'
import { adminApi } from '@/lib/api'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function label(date: string) { return formatInJakarta(date, { day: 'numeric', month: 'short' }) }
function formatUsd(value: number) { return `$${value.toFixed(value >= 1 ? 2 : 4)}` }

export default function AdminDashboard() {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()
  const usage = useQuery({ queryKey: ['admin-usage'], queryFn: () => adminApi.usage() })

  async function signOut() {
    await logout()
    navigate('/admin/login')
  }

  const data = usage.data
  return <main className="page-frame pb-28 lg:pb-10"><div className="admin-toolbar"><button className="admin-signout" onClick={() => void signOut()}>Sign out</button></div><section className="page-title"><p className="eyebrow">Administration</p><h1>AI usage across Calora.</h1><p>Tokens, calls, and cost for every member — straight from the usage ledger.</p></section>{usage.isLoading ? <div className="loading-card">Tallying usage…</div> : usage.isError ? <div className="loading-card">Could not load usage data. Please try again.</div> : data && <><section className="insight-stats"><article><span>Total spend</span><strong>{formatUsd(data.totals.costUsd)}</strong><small>USD across all AI calls</small></article><article><span>Total tokens</span><strong>{data.totals.totalTokens.toLocaleString()}</strong><small>input + output</small></article><article><span>Total calls</span><strong>{data.totals.calls.toLocaleString()}</strong><small>estimates + coach messages</small></article></section><section className="chart-card"><div className="section-heading"><div><p className="eyebrow">Daily rhythm</p><h2>Spend per day</h2></div><span className="tiny-badge">Last 30 days</span></div>{data.byDay.length === 0 ? <div className="chart-empty">No AI usage recorded yet.</div> : <div className="chart-wrap"><ResponsiveContainer width="100%" height={290}><BarChart data={data.byDay.map((day) => ({ ...day, label: label(day.date) }))}><CartesianGrid strokeDasharray="3 3" stroke="#f0e2d2" /><XAxis dataKey="label" tick={{ fill: '#8d7160', fontSize: 12 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#8d7160', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} /><Tooltip formatter={(value) => formatUsd(Number(value))} labelFormatter={(name) => `Spend · ${name}`} /><Bar dataKey="costUsd" fill="#e67638" radius={[6, 6, 0, 0]} maxBarSize={26} /></BarChart></ResponsiveContainer></div>}</section><section className="chart-card"><div className="section-heading"><div><p className="eyebrow">By member</p><h2>Usage ledger</h2></div><span className="tiny-badge">{data.totals.users} member{data.totals.users === 1 ? '' : 's'}</span></div>{data.byUser.length === 0 ? <div className="chart-empty">No usage to report yet.</div> : <div className="chart-wrap"><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead className="text-right">Calls</TableHead><TableHead className="text-right">Input tokens</TableHead><TableHead className="text-right">Cache hits</TableHead><TableHead className="text-right">Output tokens</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader><TableBody>{data.byUser.map((row) => <TableRow key={row.userId}><TableCell><b>{row.displayName}</b><br /><small>{row.email}</small></TableCell><TableCell className="text-right">{row.calls.toLocaleString()}</TableCell><TableCell className="text-right">{row.promptTokens.toLocaleString()}</TableCell><TableCell className="text-right">{row.cacheHitTokens.toLocaleString()}</TableCell><TableCell className="text-right">{row.completionTokens.toLocaleString()}</TableCell><TableCell className="text-right"><b>{formatUsd(row.costUsd)}</b></TableCell></TableRow>)}</TableBody></Table></div>}</section></>}</main>
}
