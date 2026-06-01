import { Fragment, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { RangeSummary } from '@calora/shared'
import { toDateStr, shiftDateStr, formatInJakarta } from '@calora/shared'
import { WeeklyChart } from './WeeklyChart'
import { MacroChart } from './MacroChart'
import { LogTable } from './LogTable'

interface Props {
  refreshKey: number
  onChange: () => void
}

type RangeTab = 'today' | 'lastweek' | 'thisweek' | 'custom'

function formatNum(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function formatLabel(iso: string): string {
  return formatInJakarta(iso, { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS: { id: RangeTab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'ti-calendar-due' },
  { id: 'lastweek', label: 'Last week', icon: 'ti-calendar-minus' },
  { id: 'thisweek', label: 'This week', icon: 'ti-calendar-stats' },
  { id: 'custom', label: 'Custom', icon: 'ti-calendar-event' },
]

const dateInputStyle: React.CSSProperties = {
  fontSize: 11,
  border: '0.5px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  padding: '4px 8px',
}

export function VizPanel({ refreshKey, onChange }: Props) {
  const [tab, setTab] = useState<RangeTab>('today')
  const [customFrom, setCustomFrom] = useState(() => shiftDateStr(toDateStr(), -6))
  const [customTo, setCustomTo] = useState(() => toDateStr())
  const [data, setData] = useState<RangeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  console.log(data)

  const { from, to } = useMemo(() => {
    const today = toDateStr()
    switch (tab) {
      case 'today':
        return { from: today, to: today }
      case 'thisweek':
        return { from: shiftDateStr(today, -6), to: today }
      case 'lastweek':
        return { from: shiftDateStr(today, -13), to: shiftDateStr(today, -7) }
      case 'custom':
        return { from: customFrom, to: customTo }
    }
  }, [tab, customFrom, customTo])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api<{ range: RangeSummary }>(`/logs/range?from=${from}&to=${to}`)
      .then(({ range }) => { if (!cancelled) setData(range) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to, refreshKey])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center overflow-x-auto no-scrollbar bg-card"
        style={{ height: 38, padding: '0 12px', borderBottom: '0.5px solid var(--color-border)' }}
      >
        {TABS.map((t) => (
          <Fragment key={t.id}>
            {t.id === 'custom' && (
              <span style={{ width: '0.5px', height: 16, background: 'var(--color-border)', margin: '0 6px' }} />
            )}
            <button
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center whitespace-nowrap transition-colors duration-150"
              style={{
                gap: 5,
                padding: '9px 13px',
                fontSize: 11,
                cursor: 'pointer',
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: tab === t.id ? 500 : 400,
                borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              <i className={`ti ${t.icon}`} style={{ fontSize: 13 }} />
              {t.label}
            </button>
          </Fragment>
        ))}
      </div>

      {/* Custom date picker bar */}
      {tab === 'custom' && (
        <div
          className="flex items-center bg-card"
          style={{ height: 36, padding: '0 12px', gap: 6, borderBottom: '0.5px solid var(--color-border)' }}
        >
          <i className="ti ti-calendar-search" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
          <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>From</label>
          <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} style={dateInputStyle} />
          <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>To</label>
          <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} style={dateInputStyle} />
        </div>
      )}

      {/* Content */}
      {loading || !data ? (
        <div className="flex flex-1 items-center justify-center" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          Loading…
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 12, gap: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {from === to ? formatLabel(from) : `${formatLabel(from)} – ${formatLabel(to)}`}
          </p>

          <div className="grid grid-cols-3" style={{ gap: 7 }}>
            <StatCard label="Calories in" value={data.caloriesIn} unit="kcal" />
            <StatCard label="Burned" value={data.caloriesBurned} unit="kcal" />
            <StatCard
              label="Net"
              value={data.netCalories}
              unit={`/ ${formatNum(data.netTarget)} kcal`}
              color={data.netCalories > data.netTarget ? 'var(--color-red)' : 'var(--color-primary)'}
            />
          </div>

          <section>
            <SectionLabel>Daily calorie progress</SectionLabel>
            <CalorieProgress net={data.netCalories} target={data.netTarget} />
          </section>

          {data.days > 1 && <WeeklyChart days={data.daily} />}

          <section>
            <SectionLabel>Macros</SectionLabel>
            <MacroChart
              proteinG={data.proteinG}
              carbsG={data.carbsG}
              fatG={data.fatG}
              proteinTargetG={data.proteinTargetG}
              carbsTargetG={data.carbsTargetG}
              fatTargetG={data.fatTargetG}
            />
          </section>

          <section>
            <SectionLabel>Log</SectionLabel>
            <LogTable foodLogs={data.foodLogs} workoutLogs={data.workoutLogs} onChange={onChange} />
          </section>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        marginBottom: 6,
      }}
    >
      {children}
    </p>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color?: string }) {
  return (
    <div
      className="bg-card"
      style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '9px 10px' }}
    >
      <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1, color: color ?? 'var(--color-text-primary)' }}>{formatNum(value)}</p>
      <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{unit}</p>
    </div>
  )
}

function CalorieProgress({ net, target }: { net: number; target: number }) {
  const over = net > target
  const ratio = target > 0 ? net / target : 0
  const pct = Math.min(Math.max(ratio * 100, 0), 100)
  const pctLabel = Math.round(ratio * 100)
  return (
    <div
      className="bg-card"
      style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}
    >
      <div style={{ height: 10, background: 'var(--color-surface)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 'var(--radius-pill)',
            background: over ? 'var(--color-red)' : 'var(--color-primary)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div className="flex justify-between" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{formatNum(net)} kcal net</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{pctLabel}% of target</span>
      </div>
    </div>
  )
}
