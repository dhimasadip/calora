import { cn } from '@/lib/utils'

interface Props {
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
}

export function ChatMessage({ role, content, toolsUsed }: Props) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 22,
          height: 22,
          fontSize: 9,
          fontWeight: 500,
          background: isUser ? 'var(--color-primary)' : 'var(--color-primary-light)',
          color: isUser ? '#ffffff' : 'var(--color-primary-text)',
        }}
      >
        <i className={isUser ? 'ti ti-user' : 'ti ti-sparkles'} style={{ fontSize: 11 }} />
      </div>
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className="whitespace-pre-wrap break-words"
          style={{
            fontSize: 11,
            padding: '7px 11px',
            background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
            color: isUser ? '#ffffff' : 'var(--color-text-primary)',
            borderRadius: isUser ? '11px 3px 11px 11px' : '3px 11px 11px 11px',
          }}
        >
          {content || (isUser ? '' : <span className="italic" style={{ color: 'var(--color-text-muted)' }}>thinking…</span>)}
        </div>
        {toolsUsed && toolsUsed.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {toolsUsed.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-primary-light)',
                  color: 'var(--color-primary-text)',
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 10 }} />
                {formatToolName(tool)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatToolName(tool: string): string {
  return tool.replace(/_/g, ' ').replace('save', 'saved').replace('delete', 'deleted')
}
