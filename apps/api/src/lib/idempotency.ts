import { and, eq, gt } from 'drizzle-orm'
import { db, idempotencyKeys } from '../db/index.js'
import { generateId } from './utils.js'

const TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function cachedIdempotentResponse(userId: string, key: string | undefined) {
  if (!key) return null
  const [stored] = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key), gt(idempotencyKeys.expiresAt, new Date()))).limit(1)
  return stored ? { statusCode: stored.statusCode, response: stored.response } : null
}

export async function storeIdempotentResponse(userId: string, key: string | undefined, statusCode: number, response: unknown) {
  if (!key) return
  await db.insert(idempotencyKeys).values({
    id: generateId(), userId, key, statusCode, response, expiresAt: new Date(Date.now() + TTL_MS),
  }).onConflictDoNothing()
}
