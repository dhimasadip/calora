import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { toDateStr, shiftDateStr, isDateStr, jakartaInstant } from '@calora/shared'

// Re-exported so the rest of the API keeps importing day helpers from one place.
export { toDateStr, shiftDateStr, isDateStr }

export function generateId(): string {
  return randomUUID()
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// High-entropy URL-safe token for refresh / email-verification flows. Stored only as a
// SHA-256 hash (see hashToken); the raw value is handed to the client once.
export function generateToken(): string {
  return randomBytes(48).toString('base64url')
}

// Resolve a log entry's logical `date` and a representative `loggedAt` timestamp.
// Back-dated entries (date !== today) get noon Jakarta on that day so time-of-day
// display stays sensible; same-day entries use the current instant.
export function resolveEntryDate(dateStr?: string): { date: string; loggedAt: Date } {
  const today = toDateStr()
  const date = isDateStr(dateStr) ? dateStr : today
  return { date, loggedAt: date === today ? new Date() : jakartaInstant(date, '12:00:00') }
}
