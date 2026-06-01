interface Props {
  proteinG: number
  carbsG: number
  fatG: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
}

export function MacroChart({ proteinG, carbsG, fatG, proteinTargetG, carbsTargetG, fatTargetG }: Props) {
  const macros = [
    { name: 'Protein', value: proteinG, target: proteinTargetG, color: 'var(--color-primary)' },
    { name: 'Carbs', value: carbsG, target: carbsTargetG, color: 'var(--color-blue)' },
    { name: 'Fat', value: fatG, target: fatTargetG, color: 'var(--color-amber)' },
  ]

  return (
    <div className="grid grid-cols-3" style={{ gap: 7 }}>
      {macros.map((m) => {
        const pct = m.target > 0 ? Math.min(Math.round((m.value / m.target) * 100), 100) : 0
        return (
          <div
            key={m.name}
            className="bg-card"
            style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '9px 10px' }}
          >
            <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{m.name}</p>
            <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2, color: 'var(--color-text-primary)' }}>
              {Math.round(m.value)}
              <span style={{ fontSize: 10, fontWeight: 400 }}> g</span>
            </p>
            <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>/ {Math.round(m.target)} g</p>
            <div
              style={{ height: 3, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface)', marginTop: 6, overflow: 'hidden' }}
            >
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-pill)', background: m.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
