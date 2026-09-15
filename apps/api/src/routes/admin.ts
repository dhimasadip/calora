import type { FastifyPluginAsync } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import { count, countDistinct, desc, eq, gte, sql } from 'drizzle-orm'
import { AdminLoginSchema, AdminUsageResponseSchema } from '@calora/shared'
import { db, aiUsageLogs, users } from '../db/index.js'
import { loadEnv } from '../lib/env.js'

const env = loadEnv()
const ADMIN_TOKEN_EXPIRY = '12h'
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12

function cookieOptions() {
  return { httpOnly: true, secure: env.isProd, sameSite: 'strict' as const }
}

// Constant-time comparison of the plaintext env credentials.
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(a), digest(b))
}

function assertAdminConfigured() {
  if (!env.adminEmail || !env.adminPassword) {
    const error = new Error('Admin access is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.')
    ;(error as Error & { statusCode?: number }).statusCode = 403
    throw error
  }
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const credentialRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  fastify.post('/login', credentialRateLimit, async (request, reply) => {
    assertAdminConfigured()
    const parsed = AdminLoginSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const { email, password } = parsed.data
    if (!safeEqual(email.trim().toLowerCase(), env.adminEmail.trim().toLowerCase()) || !safeEqual(password, env.adminPassword)) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }
    const token = fastify.jwt.sign({ sub: 'admin', admin: true }, { expiresIn: ADMIN_TOKEN_EXPIRY })
    reply.setCookie('access_token', token, { ...cookieOptions(), path: '/', maxAge: ADMIN_COOKIE_MAX_AGE })
    return reply.send({ admin: true })
  })

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('access_token', { path: '/' })
    return reply.send({ ok: true })
  })

  fastify.get('/me', { onRequest: [fastify.authenticateAdmin] }, async () => ({ admin: true }))

  fastify.get('/usage', { onRequest: [fastify.authenticateAdmin] }, async (request, reply) => {
    const [totals] = await db.select({
      costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd})::float8, 0)`,
      calls: count(),
      promptTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptTokens})::int, 0)`,
      completionTokens: sql<number>`coalesce(sum(${aiUsageLogs.completionTokens})::int, 0)`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLogs.totalTokens})::int, 0)`,
      cacheHitTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptCacheHitTokens})::int, 0)`,
      users: countDistinct(aiUsageLogs.userId),
    }).from(aiUsageLogs)

    const kinds = await db.select({ kind: aiUsageLogs.kind, calls: count() }).from(aiUsageLogs).groupBy(aiUsageLogs.kind)

    const since = new Date()
    since.setDate(since.getDate() - 29)
    since.setHours(0, 0, 0, 0)
    const byDay = await db.select({
      date: sql<string>`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`,
      costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd})::float8, 0)`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLogs.totalTokens})::int, 0)`,
      calls: sql<number>`count(*)::int`,
    }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, since)).groupBy(sql`1`).orderBy(sql`1`)

    const byUser = await db.select({
      userId: aiUsageLogs.userId,
      email: users.email,
      displayName: users.displayName,
      calls: count(),
      promptTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptTokens})::int, 0)`,
      completionTokens: sql<number>`coalesce(sum(${aiUsageLogs.completionTokens})::int, 0)`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLogs.totalTokens})::int, 0)`,
      cacheHitTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptCacheHitTokens})::int, 0)`,
      costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd})::float8, 0)`,
    }).from(aiUsageLogs).innerJoin(users, eq(aiUsageLogs.userId, users.id))
      .groupBy(aiUsageLogs.userId, users.email, users.displayName)
      .orderBy(desc(sql`sum(${aiUsageLogs.costUsd})`))
      .limit(200)

    const response = {
      totals: {
        ...totals,
        byKind: {
          foodEstimate: kinds.find((row) => row.kind === 'food_estimate')?.calls ?? 0,
          exerciseEstimate: kinds.find((row) => row.kind === 'exercise_estimate')?.calls ?? 0,
          coach: kinds.find((row) => row.kind === 'coach')?.calls ?? 0,
        },
      },
      byDay,
      byUser,
    }
    const parsed = AdminUsageResponseSchema.safeParse(response)
    if (!parsed.success) return reply.status(500).send({ error: 'Unexpected usage response shape' })
    return reply.send(parsed.data)
  })
}
