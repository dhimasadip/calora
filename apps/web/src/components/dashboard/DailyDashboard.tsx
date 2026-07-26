import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ExerciseEntry, FoodEntry } from '@calora/shared'
import { formatInJakarta, shiftDateStr, toDateStr } from '@calora/shared'
import { caloraApi } from '@/lib/api'
import { EntryComposer } from '@/components/entries/EntryComposer'
import { showConfirmModal } from '@/components/ui/confirm-modal'

type ComposerState = { kind: 'food' | 'workout'; entry?: FoodEntry | ExerciseEntry } | null

function niceDate(date: string) { return formatInJakarta(date, { weekday: 'long', day: 'numeric', month: 'long' }) }
function number(value: number) { return Math.round(value).toLocaleString() }

export function DailyDashboard() {
  const [date, setDate] = useState(toDateStr())
  const [composer, setComposer] = useState<ComposerState>(null)
  const client = useQueryClient()
  const report = useQuery({ queryKey: ['report', date], queryFn: () => caloraApi.report(date, date).then((response) => response.summary) })
  const foods = useQuery({ queryKey: ['food-entries', date], queryFn: () => caloraApi.foods(date, date).then((response) => response.entries) })
  const workouts = useQuery({ queryKey: ['workout-entries', date], queryFn: () => caloraApi.workouts(date, date).then((response) => response.entries) })
  const data = report.data
  const macros = useMemo(() => [
    ['Protein', data?.proteinG ?? 0, data?.proteinTargetG ?? 0, 'protein'],
    ['Carbs', data?.carbsG ?? 0, data?.carbsTargetG ?? 0, 'carbs'],
    ['Fat', data?.fatG ?? 0, data?.fatTargetG ?? 0, 'fat'],
  ] as const, [data])
  const refresh = () => client.invalidateQueries({ queryKey: ['report'] }).then(() => Promise.all([client.invalidateQueries({ queryKey: ['food-entries'] }), client.invalidateQueries({ queryKey: ['workout-entries'] })]))

  async function remove(entry: FoodEntry | ExerciseEntry) {
    if (!await showConfirmModal({ title: 'Delete this entry?', description: `“${entry.name}” will be permanently removed from your log.`, confirmLabel: 'Delete entry', destructive: true })) return
    if ('quantity' in entry) await caloraApi.deleteFood(entry.id, entry.version)
    else await caloraApi.deleteWorkout(entry.id, entry.version)
    void refresh()
  }

  const today = toDateStr()
  const yesterday = shiftDateStr(today, -1)
  const selectedDateLabel = date === today ? 'Today' : date === yesterday ? 'Yesterday' : niceDate(date)
  const net = data?.netCalories ?? 0
  const target = data?.targetCalories ?? 2000
  const remaining = data?.remaining ?? target
  const pct = Math.min(100, Math.max(0, (net / Math.max(target, 1)) * 100))

  return (
    <main className="page-frame pb-28 lg:pb-10">
      <section className="dashboard-hero">
        <div className="hero-copy"><p className="eyebrow text-orange-800">A softer way to stay on track</p><h1>{date === today ? 'Make today feel good.' : selectedDateLabel}</h1><p>Small, honest logs build a rhythm you can trust.</p></div>
        <aside className="date-filter" aria-label="Dashboard date filter">
          <div className="date-filter-heading"><span>Viewing day</span><strong>{selectedDateLabel}</strong></div>
          <div className="date-filter-row"><button type="button" onClick={() => setDate(shiftDateStr(date, -1))} aria-label="Previous day">←</button><label><span>Choose date</span><input type="date" value={date} max={today} onChange={(event) => { if (event.target.value) setDate(event.target.value) }} /></label><button type="button" onClick={() => setDate(shiftDateStr(date, 1))} disabled={date >= today} aria-label="Next day">→</button></div>
          <div className="date-shortcuts"><button type="button" className={date === today ? 'selected' : ''} onClick={() => setDate(today)}>Today</button><button type="button" className={date === yesterday ? 'selected' : ''} onClick={() => setDate(yesterday)}>Yesterday</button></div>
        </aside>
      </section>
      <section className="quick-actions"><button className="quick-action food" onClick={() => setComposer({ kind: 'food' })}><span>☀️</span><div><b>Add food</b><small>Manual or AI assisted</small></div><i>+</i></button><button className="quick-action workout" onClick={() => setComposer({ kind: 'workout' })}><span>🏃</span><div><b>Add workout</b><small>Manual or AI assisted</small></div><i>+</i></button></section>
      {report.isLoading ? <div className="loading-card">Gathering {selectedDateLabel.toLowerCase()}’s picture…</div> : <>
        <section className="daily-grid">
          <article className="sun-card calorie-card"><div className="calorie-dial" style={{ background: `conic-gradient(#e97932 ${pct}%, #f7dfc6 ${pct}% 100%)` }}><div><strong>{number(Math.max(0, remaining))}</strong><span>{remaining >= 0 ? 'left' : 'over'} kcal</span></div></div><div className="metric-copy"><p className="eyebrow">Your daily rhythm</p><h2>{number(net)} <small>/ {number(target)} kcal</small></h2><p>{remaining >= 0 ? 'You have space for a nourishing next meal.' : 'A little over the target — that’s still useful data.'}</p></div></article>
          <article className="sun-card balance-card"><p className="eyebrow">Energy balance</p><div className="balance-values"><div><span>In</span><strong>{number(data?.caloriesIn ?? 0)}</strong><small>kcal eaten</small></div><div className="balance-divider">−</div><div><span>Out</span><strong>{number(data?.caloriesBurned ?? 0)}</strong><small>kcal moved</small></div></div></article>
        </section>
        <section className="content-grid">
          <article className="sun-card"><div className="section-heading"><div><p className="eyebrow">Macros</p><h2>Fuel mix</h2></div><span className="tiny-badge">{selectedDateLabel}</span></div><div className="macro-list">{macros.map(([label, amount, macroTarget, tone]) => { const progress = Math.min(100, Math.round(amount / Math.max(macroTarget, 1) * 100)); return <div key={label} className="macro-row"><div className="macro-label"><span>{label}</span><b>{Math.round(amount)}g <small>/ {Math.round(macroTarget)}g</small></b></div><div className={`macro-track ${tone}`}><i style={{ width: `${progress}%` }} /></div></div> })}</div></article>
          <article className="sun-card"><div className="section-heading"><div><p className="eyebrow">Little win</p><h2>Consistency grows here</h2></div><span className="spark">✦</span></div><p className="gentle-copy">Every confirmed entry is a vote for the routine you want. Keep it simple; keep it kind.</p><button className="text-action" onClick={() => setComposer({ kind: 'food' })}>Log your next bite <span>→</span></button></article>
        </section>
        <section className="log-section"><div className="section-heading"><div><p className="eyebrow">Timeline · {selectedDateLabel}</p><h2>{date === today ? 'Today’s log' : 'Entries for this day'}</h2></div><span className="tiny-badge">{(foods.data?.length ?? 0) + (workouts.data?.length ?? 0)} entries</span></div><div className="entry-grid">{[...(foods.data ?? []), ...(workouts.data ?? [])].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()).map((entry) => { const food = 'quantity' in entry; return <article key={entry.id} className="entry-card"><span className={`entry-icon ${food ? 'food' : 'workout'}`}>{food ? '🍽️' : '⚡'}</span><button className="entry-info" onClick={() => setComposer({ kind: food ? 'food' : 'workout', entry })}><b>{entry.name}</b><small>{food ? `${entry.mealType} · ${entry.quantity} ${entry.unit}` : `${entry.workoutType} · ${entry.durationMinutes} min`}</small></button><strong className={food ? '' : 'burned'}>{food ? '+' : '−'}{number(food ? entry.calories : entry.caloriesBurned)}</strong><button className="delete-entry" onClick={() => void remove(entry)} aria-label={`Delete ${entry.name}`}>×</button></article> })}{!foods.data?.length && !workouts.data?.length && <div className="empty-log"><span>🌼</span><h3>Nothing logged yet</h3><p>Start with the meal or movement already on your mind.</p></div>}</div></section>
      </>}
      {composer && <EntryComposer kind={composer.kind} date={date} entry={composer.entry} open onClose={() => setComposer(null)} onSaved={() => { void refresh() }} />}
    </main>
  )
}
