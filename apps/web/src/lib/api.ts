const API_BASE = '/api/v1'

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/me' && path !== '/auth/login') {
    // Try refresh once, then retry
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (refreshRes.ok) {
      return api(path, options)
    }
  }

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed with ${res.status}`
    throw new ApiError(res.status, typeof message === 'string' ? message : 'Request failed', data)
  }

  return data as T
}

// Streaming SSE for agent messages
export async function streamAgent(
  content: string,
  sessionId: string,
  callbacks: {
    onDelta?: (text: string) => void
    onToolUse?: (tool: string) => void
    onDone?: (toolsUsed: string[]) => void
    onError?: (message: string) => void
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/agent/message`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sessionId }),
  })

  if (!res.ok || !res.body) {
    callbacks.onError?.(`Request failed with status ${res.status}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const block of events) {
      const lines = block.split('\n')
      let eventName = 'message'
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim()
        if (line.startsWith('data: ')) dataLine = line.slice(6)
      }
      if (!dataLine) continue
      try {
        const data = JSON.parse(dataLine)
        if (eventName === 'delta') callbacks.onDelta?.(data.text)
        else if (eventName === 'tool_use') callbacks.onToolUse?.(data.tool)
        else if (eventName === 'done') callbacks.onDone?.(data.toolsUsed ?? [])
        else if (eventName === 'error') callbacks.onError?.(data.message)
      } catch {
        // ignore malformed event
      }
    }
  }
}
