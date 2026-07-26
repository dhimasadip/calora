import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AiUsage } from '@calora/shared'
import { caloraApi, streamCoach } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = { role: 'user' | 'assistant'; content: string }

export function CoachDrawer({ open, onClose }: { open: boolean; onClose(): void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Hi, I’m your Calora coach. I can help you reflect on today — use the Add buttons when you’re ready to save an editable entry.' }])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const sessionId = useMemo(() => `coach-${new Date().toISOString().slice(0, 10)}`, [])
  useEffect(() => { if (open) void caloraApi.aiUsage().then(setUsage).catch(() => undefined) }, [open])
  if (!open) return null
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!text.trim() || sending) return
    const value = text.trim(); setText(''); setSending(true); setMessages((current) => [...current, { role: 'user', content: value }, { role: 'assistant', content: '' }])
    await streamCoach(value, sessionId, {
      onDelta(delta) { setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: message.content + delta } : message)) },
      onError(message) { setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: `Sorry — ${message}` } : item)) },
      onDone(nextUsage) { setUsage(nextUsage); setSending(false) },
    })
    setSending(false)
  }
  return <aside className="coach-drawer" aria-label="Calora coach"><div className="coach-header"><div><p className="eyebrow">Gentle guidance</p><h2>Your coach</h2>{usage && <span className="ai-quota">{usage.remaining} of {usage.limit} AI uses left today</span>}</div><button className="icon-button" onClick={onClose} aria-label="Close coach">×</button></div><div className="coach-messages">{messages.map((message, index) => <div key={index} className={`coach-message ${message.role}`}>{message.role === 'assistant' ? (message.content ? <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : <span className="typing">Thinking…</span>) : message.content}</div>)}</div><form className="coach-form" onSubmit={submit}><textarea className="wellness-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask about your day…" /><button className="primary-action" disabled={sending || !text.trim() || usage?.remaining === 0}>Send</button></form></aside>
}
