import { useMemo, useState } from 'react'
import { toDateStr } from '@calora/shared'
import { Header } from '@/components/layout/Header'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { VizPanel } from '@/components/viz/VizPanel'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const sessionId = useMemo(() => `session-${toDateStr()}`, [])

  const handleLogChange = () => setRefreshKey((k) => k + 1)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header />
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile-only handle/tab that toggles the data sheet */}
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          aria-expanded={sheetOpen}
          className="md:hidden relative z-40 flex shrink-0 items-center justify-between bg-card px-4"
          style={{ height: 38, borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span className="flex items-center" style={{ gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <i className="ti ti-chart-bar" style={{ fontSize: 14 }} />
            Data
          </span>
          <i
            className={`ti ${sheetOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`}
            style={{ fontSize: 16, color: 'var(--color-text-secondary)' }}
          />
        </button>

        {/* Chat: left column on desktop, fills the screen on mobile */}
        <div className="flex-1 overflow-hidden md:flex-none md:w-[38%] md:h-full md:border-r-[0.5px]">
          <ChatPanel sessionId={sessionId} onLogChange={handleLogChange} />
        </div>

        {/* Data: right column on desktop; slide-down top sheet on mobile.
            Rendered once — responsive classes switch positioning. */}
        <div
          className={`overflow-hidden bg-card absolute inset-x-0 top-[38px] bottom-0 z-30 transition-transform duration-300 md:static md:inset-auto md:z-auto md:w-[62%] md:h-full md:translate-y-0 md:transition-none ${
            sheetOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <VizPanel refreshKey={refreshKey} onChange={handleLogChange} />
        </div>
      </div>
    </div>
  )
}
