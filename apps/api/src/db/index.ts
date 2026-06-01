import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { APP_TIMEZONE } from '@calora/shared'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

export const client = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
  // Pin every connection's session timezone to Jakarta. Our `timestamp` columns are
  // `without time zone`, so `now()`, `CURRENT_DATE`, and day-window comparisons are all
  // interpreted in the session timezone. Postgres defaults to UTC (the docker image sets
  // no TZ), which silently shifts "today" by 7h and drops evening entries from filters.
  connection: { TimeZone: APP_TIMEZONE },
})

export const db = drizzle(client, { schema })

export type DB = typeof db
export * from './schema.js'
