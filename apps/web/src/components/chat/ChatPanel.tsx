import { useEffect, useRef, useState, type FormEvent } from 'react'
import { streamAgent, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from './ChatMessage'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

      <form onSubmit={handleSubmit} className="flex gap-2 p-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
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
  )
}
