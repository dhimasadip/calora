// Calora anchors every calendar-day decision — what "today" is, which day a log
// belongs to, and all day-range filters — to Jakarta time, so the result is the
// same for every user and server regardless of where they physically run.
// Asia/Jakarta (WIB) is a fixed UTC+7 offset with no daylight saving, which keeps
// the instant math simple and unambiguous.

export const APP_TIMEZONE = 'Asia/Jakarta'
const JAKARTA_UTC_OFFSET = '+07:00'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// en-CA renders dates as YYYY-MM-DD, which is exactly the calendar-day format we use.
const jakartaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Jakarta calendar day ('YYYY-MM-DD') for the given instant (defaults to now).
export function toDateStr(date: Date = new Date()): string {
  return jakartaDayFormatter.format(date)
}

// Shift a 'YYYY-MM-DD' string by N calendar days. Pure date arithmetic performed
// in UTC so it never depends on the host timezone.
export function shiftDateStr(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function isDateStr(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

// The UTC instant for a given time-of-day on a Jakarta calendar day (default: midnight).
// Useful as inclusive/exclusive bounds when filtering timestamp columns by Jakarta day.
export function jakartaInstant(dateStr: string, time = '00:00:00'): Date {
  return new Date(`${dateStr}T${time}${JAKARTA_UTC_OFFSET}`)
}

// Format an instant — or a bare 'YYYY-MM-DD' calendar day — for display in Jakarta
// time. Calendar-day strings are anchored at noon Jakarta so the rendered weekday /
// day never slips to an adjacent date.
export function formatInJakarta(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const instant = typeof date === 'string' ? jakartaInstant(date, '12:00:00') : date
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIMEZONE }).format(instant)
}
