import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { formatInJakarta } from '@calora/shared'

interface Day {
  date: string
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  target: number
}

interface Props {
  days: Day[]
}

export function WeeklyChart({ days }: Props) {
  const data = days.map((d) => ({
    day: `${formatInJakarta(d.date, { weekday: 'short' })} ${formatInJakarta(d.date, { day: 'numeric' })}`,
    in: d.caloriesIn,
    net: d.netCalories,
  }))

  const target = days[0]?.target ?? 2000

  return (
    <div
      className="bg-card"
      style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}
    >
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
        Calories per day
      </p>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '0.5px solid hsl(var(--border))',
                borderRadius: 'var(--radius-md)',
                fontSize: 11,
              }}
            />
            <ReferenceLine
              y={target}
              stroke="var(--color-text-muted)"
              strokeDasharray="3 3"
              label={{ value: 'Target', fontSize: 10, fill: 'var(--color-text-muted)' }}
            />
            <Area
              type="monotone"
              dataKey="in"
              name="Calories in"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="hsl(var(--chart-1))"
              fillOpacity={0.07}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center" style={{ gap: 14, marginTop: 8 }}>
        <LegendKey color="var(--color-primary)" label="Calories in" />
        <LegendKey color="var(--color-blue)" label="Net" />
      </div>
    </div>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
    </span>
  )
}
