import type { AiUsage, ExerciseEstimate, ExerciseEntry, FoodEstimate, FoodEntry, ReminderPreferences, ReportSummary, UserProfile, WeightLog } from '@calora/shared'
import { showErrorToast } from '@/components/ui/toast'

const API_BASE = '/api/v1'
const GENERIC_SERVER_ERROR = 'Something went wrong. Please try again.'
let lastToast: { message: string; at: number } | undefined

interface ApiOptions extends Omit<RequestInit, 'body'> { body?: unknown; suppressToast?: boolean }

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}

function notifyError(message: string, suppressToast: boolean) {
  if (suppressToast || typeof window === 'undefined') return
  const now = Date.now()
  if (lastToast?.message === message && now - lastToast.at < 2_000) return
  lastToast = { message, at: now }
  showErrorToast(message)
}

function responseErrorMessage(data: unknown, status: number) {
  const error = (data as { error?: unknown } | null)?.error
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    for (const value of Object.values(error)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
      if (typeof value === 'string') return value
    }
  }
  return `Request failed with ${status}`
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, suppressToast = false, ...rest } = options
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    const message = 'We couldn’t reach Calora. Check your connection and try again.'
    notifyError(message, suppressToast)
    throw new ApiError(0, message)
  }
  if (response.status === 401 && !['/auth/refresh', '/auth/me', '/auth/login', '/auth/register'].includes(path)) {
    const refresh = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (refresh.ok) return api(path, options)
  }
  const text = await response.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const message = response.status >= 500 ? GENERIC_SERVER_ERROR : responseErrorMessage(data, response.status)
    notifyError(message, suppressToast)
    throw new ApiError(response.status, message, data)
  }
  return data as T
}

export const caloraApi = {
  profile: () => api<{ profile: UserProfile }>('/profile'),
  updateProfile: (body: Partial<UserProfile>) => api<{ profile: UserProfile }>('/profile', { method: 'PATCH', body }),
  report: (from: string, to: string) => api<{ summary: ReportSummary }>(`/reports/summary?from=${from}&to=${to}`),
  foods: (from: string, to: string) => api<{ entries: FoodEntry[] }>(`/food-entries?from=${from}&to=${to}`),
  workouts: (from: string, to: string) => api<{ entries: ExerciseEntry[] }>(`/exercise-entries?from=${from}&to=${to}`),
  createFood: (body: unknown, idempotencyKey?: string) => api<{ entry: FoodEntry }>('/food-entries', { method: 'POST', body, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }),
  createWorkout: (body: unknown, idempotencyKey?: string) => api<{ entry: ExerciseEntry }>('/exercise-entries', { method: 'POST', body, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }),
  updateFood: (id: string, body: unknown) => api<{ entry: FoodEntry }>(`/food-entries/${id}`, { method: 'PATCH', body }),
  updateWorkout: (id: string, body: unknown) => api<{ entry: ExerciseEntry }>(`/exercise-entries/${id}`, { method: 'PATCH', body }),
  deleteFood: (id: string, expectedVersion: number) => api(`/food-entries/${id}`, { method: 'DELETE', body: { expectedVersion } }),
  deleteWorkout: (id: string, expectedVersion: number) => api(`/exercise-entries/${id}`, { method: 'DELETE', body: { expectedVersion } }),
  aiUsage: () => api<AiUsage>('/ai/usage'),
  foodEstimate: (description: string, mealType?: string) => api<{ estimate: FoodEstimate; cached: boolean } & AiUsage>('/ai/food-estimate', { method: 'POST', body: { description, mealType } }),
  workoutEstimate: (description: string) => api<{ estimate: ExerciseEstimate; cached: boolean } & AiUsage>('/ai/exercise-estimate', { method: 'POST', body: { description } }),
  weights: (from: string, to: string) => api<{ logs: WeightLog[] }>(`/weight-logs?from=${from}&to=${to}`),
  saveWeight: (body: unknown) => api<{ log: WeightLog }>('/weight-logs', { method: 'POST', body }),
  reminders: () => api<{ preferences: ReminderPreferences }>('/settings/reminders'),
  saveReminders: (body: ReminderPreferences) => api<{ preferences: ReminderPreferences }>('/settings/reminders', { method: 'PUT', body }),
}

export async function streamCoach(content: string, sessionId: string, handlers: { onDelta(text: string): void; onError(message: string): void; onDone(usage: AiUsage): void }) {
  let response: Response
  try { response = await fetch(`${API_BASE}/ai/coach`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, sessionId }) }) }
  catch { const message = 'We couldn’t reach Calora. Check your connection and try again.'; showErrorToast(message); handlers.onError(message); return }
  if (!response.ok || !response.body) { const data = await response.json().catch(() => null); const message = response.status >= 500 ? GENERIC_SERVER_ERROR : responseErrorMessage(data, response.status); showErrorToast(message); handlers.onError(message); return }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n'); buffer = events.pop() ?? ''
      for (const event of events) {
        const name = event.match(/^event: (.+)$/m)?.[1]; const raw = event.match(/^data: (.+)$/m)?.[1]
        if (!raw) continue
        try {
          const data = JSON.parse(raw)
          if (name === 'delta') handlers.onDelta(data.text)
          else if (name === 'error') { notifyError(data.message || GENERIC_SERVER_ERROR, false); handlers.onError(data.message || GENERIC_SERVER_ERROR) }
          else if (name === 'done') handlers.onDone({ limit: Number(data.limit) || 0, used: Number(data.used) || 0, remaining: Number(data.remaining) || 0 })
        } catch { /* ignore malformed SSE */ }
      }
    }
  } catch {
    const message = 'The coach connection was interrupted. Please try again.'
    notifyError(message, false)
    handlers.onError(message)
  }
}
