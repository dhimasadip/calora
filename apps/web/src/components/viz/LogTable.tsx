import { api } from '@/lib/api'
import type { FoodLog, WorkoutLog } from '@calora/shared'
import { formatInJakarta } from '@calora/shared'

interface Props {
  foodLogs: FoodLog[]
  workoutLogs: WorkoutLog[]
  onChange: () => void
}

type Row =
  | { kind: 'food'; id: string; loggedAt: string; description: string; calories: number }
  | { kind: 'workout'; id: string; loggedAt: string; description: string; caloriesBurned: number }

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatInJakarta(d, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function LogTable({ foodLogs, workoutLogs, onChange }: Props) {
  async function deleteFood(id: string) {
    await api(`/logs/food/${id}`, { method: 'DELETE' })
    onChange()
  }
  async function deleteWorkout(id: string) {
    await api(`/logs/workout/${id}`, { method: 'DELETE' })
    onChange()
  }

  if (foodLogs.length === 0 && workoutLogs.length === 0) {
    return (
      <div
        className="bg-card flex flex-col items-center justify-center"
        style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 24 }}
      >
        <i className="ti ti-salad" style={{ fontSize: 28, color: 'var(--color-text-muted)' }} />
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>No logs yet today.</p>
      </div>
    )
  }

  const rows: Row[] = [
    ...foodLogs.map((f): Row => ({ kind: 'food', id: f.id, loggedAt: f.loggedAt, description: f.description, calories: f.calories })),
    ...workoutLogs.map((w): Row => ({ kind: 'workout', id: w.id, loggedAt: w.loggedAt, description: w.description, caloriesBurned: w.caloriesBurned })),
  ].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())

  const headerStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    padding: '7px 10px',
    textAlign: 'left',
    borderBottom: '0.5px solid var(--color-border)',
  }

  return (
    <div
      className="bg-card"
      style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
    >
      <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <colgroup>
          <col style={{ width: 48 }} />
          <col />
          <col style={{ width: 72 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 30 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={headerStyle}>Time</th>
            <th style={headerStyle}>Name</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Kcal</th>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const last = i === rows.length - 1
            const cell: React.CSSProperties = {
              padding: '7px 10px',
              borderBottom: last ? 'none' : '0.5px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              verticalAlign: 'middle',
            }
            const isFood = row.kind === 'food'
            const kcalValue = isFood ? Math.round(row.calories) : -Math.round(row.caloriesBurned)
            const kcalColor = isFood
              ? row.calories > 600
                ? 'var(--color-red)'
                : 'var(--color-text-primary)'
              : 'var(--color-blue)'

            return (
              <tr key={`${row.kind}-${row.id}`} className="group">
                <td style={{ ...cell, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatTime(row.loggedAt)}</td>
                <td style={cell}>
                  <span className="flex items-center" style={{ minWidth: 0 }}>
                    <i
                      className={isFood ? 'ti ti-salad' : 'ti ti-run'}
                      style={{ fontSize: 11, marginRight: 4, color: isFood ? 'var(--color-primary)' : 'var(--color-blue)', flexShrink: 0 }}
                    />
                    <span className="truncate">{row.description}</span>
                  </span>
                </td>
                <td style={{ ...cell, textAlign: 'right', color: kcalColor, fontWeight: 500, whiteSpace: 'nowrap' }}>{kcalValue}</td>
                <td style={cell}>
                  <span
                    className="inline-flex items-center"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-pill)',
                      background: isFood ? 'var(--color-primary-light)' : 'var(--color-blue-light)',
                      color: isFood ? 'var(--color-primary-text)' : 'var(--color-blue-text)',
                    }}
                  >
                    {isFood ? 'Food' : 'Workout'}
                  </span>
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => (isFood ? deleteFood(row.id) : deleteWorkout(row.id))}
                    title="Delete"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 13 }} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
