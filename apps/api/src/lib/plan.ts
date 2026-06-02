import { sql } from 'drizzle-orm'
import { users } from '../db/index.js'
import type { Plan } from '@calora/shared'

// Pro expires, so the *effective* plan must be derived at read time. We evaluate expiry in
// SQL with now() (the connection's session timezone is pinned to Jakarta — see db/index.ts),
// so it lines up with the tz-naive `plan_expires_at` value and never has a UTC offset bug.

// SQL boolean — true when the user currently has an active (non-expired) Pro plan.
export const isProActiveSql = sql<boolean>`(${users.plan} = 'pro' and ${users.planExpiresAt} is not null and ${users.planExpiresAt} > now())`

// SQL text — `plan_expires_at` as a tz-naive Jakarta wall-clock string (or null), safe to
// send to the client as-is. The frontend shows the date portion without re-converting tz.
export const planExpiresAtStrSql = sql<string | null>`to_char(${users.planExpiresAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`

export function effectivePlan(isProActive: boolean): Plan {
  return isProActive ? 'pro' : 'free'
}
