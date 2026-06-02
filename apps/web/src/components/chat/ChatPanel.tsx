import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { streamAgent, api } from '@/lib/api'
import { jakartaInstant, type ChatUsage } from '@calora/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from './ChatMessage'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
}

// `resetAt` is a tz-naive Jakarta wall-clock string ("YYYY-MM-DDTHH:MM:SS"). Anchor it to
// the +07:00 offset via jakartaInstant so the countdown is correct in any client timezone.
function resetMs(resetAt: string): number {
  const [day, time] = resetAt.split('T')
  return jakartaInstant(day, time).getTime() - Date.now()
}

function formatResetIn(ms: number): string {
  if (ms <= 0) return 'now'
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 1) return `${h}h ${m}m`
  return `${m}m`
}

interface Props {
  sessionId: string
  onLogChange: () => void
}

export function ChatPanel({ sessionId, onLogChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Calora. Tell me what you ate or what workout you did, and I'll track it for you. You can also ask me how many calories you have left today.",
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [tick, setTick] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadUsage = useCallback(() => {
    api<ChatUsage>('/agent/usage')
      .then(setUsage)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  // Re-render every 30s so the "resets in" countdown stays current without polling.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Once the window elapses, pull fresh usage so the quota visibly refills.
  useEffect(() => {
    if (usage?.resetAt && resetMs(usage.resetAt) <= 0) loadUsage()
  }, [usage, tick, loadUsage])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Load today's conversation history on mount
  useEffect(() => {
    let cancelled = false
    api<{ messages: { id: string; role: 'user' | 'assistant'; content: string }[] }>('/agent/messages')
      .then(({ messages: history }) => {
        if (cancelled || history.length === 0) return
        setMessages(history.map((m) => ({ id: m.id, role: m.role, content: m.content })))
      })
      .catch(() => {
        // Keep the welcome message if history can't be loaded
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: input }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    const content = input
    setInput('')
    setStreaming(true)

    let buffered = ''
    const toolsUsed: string[] = []

    try {
      await streamAgent(content, sessionId, {
        onDelta: (text) => {
          buffered += text
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: buffered } : m)))
        },
        onToolUse: (tool) => {
          toolsUsed.push(tool)
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, toolsUsed: [...toolsUsed] } : m)))
        },
        onDone: () => {
          if (toolsUsed.length > 0) onLogChange()
        },
        onError: (msg) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m)))
        },
      })
    } finally {
      setStreaming(false)
      loadUsage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div
        className="flex items-center gap-2 px-4"
        style={{ height: 34, borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span
          className="calora-pulse rounded-full"
          style={{ width: 6, height: 6, background: 'var(--color-primary)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Calora agent</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} toolsUsed={m.toolsUsed} />
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-1.5 items-center" style={{ marginLeft: 30 }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-text-muted)' }} />
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-text-muted)', animationDelay: '0.2s' }} />
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-text-muted)', animationDelay: '0.4s' }} />
          </div>
        )}
      </div>

      <div style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {usage && (
          <div className="flex items-center justify-between px-3 pt-2" style={{ fontSize: 10 }}>
            <span
              className="flex items-center gap-1"
              style={{ color: usage.remaining === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
              title={usage.plan === 'pro' ? `Pro plan · ${usage.limit} messages / 6h` : `Free plan · ${usage.limit} messages / day`}
            >
              <i className="ti ti-bolt" style={{ fontSize: 11 }} />
              {usage.remaining}/{usage.limit} chats left{usage.plan === 'pro' ? '' : ' today'}
            </span>
            <span className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <i className="ti ti-clock" style={{ fontSize: 11 }} />
              {usage.resetAt ? `resets in ${formatResetIn(resetMs(usage.resetAt))}` : 'resets 6h after first chat'}
            </span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you ate or what workout you did…"
            disabled={streaming}
            className="flex-1 h-auto rounded-md text-[11px]"
            style={{ background: 'var(--color-surface)', padding: '7px 11px' }}
          />
          <Button
            type="submit"
            disabled={streaming || !input.trim()}
            className="h-auto rounded-md py-[7px] px-[13px]"
          >
            <i className="ti ti-send" style={{ fontSize: 15 }} />
          </Button>
        </form>
      </div>
    </div>
  )
}
