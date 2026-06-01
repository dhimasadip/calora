import { APP_TIMEZONE } from '@calora/shared'

// Anchor the Node process to Jakarta time. Our `timestamp without time zone` columns
// are read back via `new Date(text)`, which interprets the naive value in the process
// timezone — so the process must match the DB session timezone (also pinned to Jakarta
// in db/index.ts) for timestamps to round-trip correctly. Imported first in index.ts,
// before anything that touches Date, so the setting is active everywhere.
process.env.TZ = APP_TIMEZONE
