import type { FastifyPluginAsync } from 'fastify'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { WeightLogSchema } from '@calora/shared'
import { db, userProfiles, weightLogs } from '../db/index.js'
import { deriveProfileValues } from './onboarding.js'
import { generateId, isDateStr, toDateStr } from '../lib/utils.js'

export const weightRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const query = request.query as { from?: string; to?: string }
    const from = isDateStr(query.from) ? query.from : '1900-01-01'
    const to = isDateStr(query.to) ? query.to : toDateStr()
    const logs = await db.select().from(weightLogs).where(and(eq(weightLogs.userId, request.userId), gte(weightLogs.date, from), lte(weightLogs.date, to))).orderBy(asc(weightLogs.date))
    return { logs }
  })

  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = WeightLogSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const data = parsed.data
    const [existing] = await db.select().from(weightLogs).where(and(eq(weightLogs.userId, request.userId), eq(weightLogs.date, data.date))).limit(1)
    if (existing && data.expectedVersion !== existing.version) return reply.status(409).send({ error: 'This weight log changed on another device', code: 'VERSION_CONFLICT', serverRecord: existing })
    const [log] = existing
      ? await db.update(weightLogs).set({ weightKg: data.weightKg, version: existing.version + 1, updatedAt: new Date() }).where(eq(weightLogs.id, existing.id)).returning()
      : await db.insert(weightLogs).values({ id: generateId(), userId: request.userId, date: data.date, weightKg: data.weightKg }).returning()

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    if (profile) {
      const values = deriveProfileValues({ weightKg: data.weightKg }, profile)
      await db.update(userProfiles).set({ ...values, updatedAt: new Date() }).where(eq(userProfiles.userId, request.userId))
    }
    return reply.status(existing ? 200 : 201).send({ log })
  })

  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { expectedVersion } = request.body as { expectedVersion?: number }
    if (!Number.isInteger(expectedVersion) || expectedVersion === undefined || expectedVersion < 1) return reply.status(400).send({ error: 'expectedVersion is required' })
    const id = (request.params as { id: string }).id
    const deleted = await db.delete(weightLogs).where(and(eq(weightLogs.id, id), eq(weightLogs.userId, request.userId), eq(weightLogs.version, expectedVersion))).returning({ id: weightLogs.id })
    if (deleted[0]) return { ok: true }
    const [serverRecord] = await db.select().from(weightLogs).where(and(eq(weightLogs.id, id), eq(weightLogs.userId, request.userId))).limit(1)
    if (!serverRecord) return reply.status(404).send({ error: 'Weight log not found' })
    return reply.status(409).send({ error: 'This weight log changed on another device', code: 'VERSION_CONFLICT', serverRecord })
  })
}
