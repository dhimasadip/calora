import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  caloriesIn: number
  caloriesBurned: number
  dailyTarget: number
}

export function DailyChart({ caloriesIn, caloriesBurned, dailyTarget }: Props) {
  const net = caloriesIn - caloriesBurned
  const consumed = Math.min(net, dailyTarget)
  const remaining = Math.max(dailyTarget - net, 0)
  const over = Math.max(net - dailyTarget, 0)

  const data = over > 0
    ? [
        { name: 'Target', value: dailyTarget, color: 'hsl(var(--chart-1))' },
        { name: 'Over', value: over, color: 'hsl(var(--destructive))' },
      ]
    : [
        { name: 'Consumed', value: consumed, color: 'hsl(var(--chart-1))' },
        { name: 'Remaining', value: remaining, color: 'hsl(var(--muted))' },
      ]

  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span style={{ fontSize: 36, fontWeight: 500, lineHeight: 1, color: 'var(--color-text-primary)' }}>
            {Math.round(net)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            / {Math.round(dailyTarget)} kcal
          </span>
          {over > 0 ? (
            <span style={{ fontSize: 10, color: 'var(--color-red)', marginTop: 2 }}>{Math.round(over)} over</span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--color-primary)', marginTop: 2 }}>{Math.round(remaining)} remaining</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3" style={{ gap: 7 }}>
        <StatCard label="In" value={caloriesIn} />
        <StatCard label="Burned" value={caloriesBurned} />
        <StatCard label="Net" value={net} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="bg-card"
      style={{ border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '9px 10px' }}
    >
      <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1, color: 'var(--color-text-primary)' }}>
        {Math.round(value)}
      </p>
    </div>
  )
}
