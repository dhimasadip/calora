import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { ReminderPreferencesSchema } from '@calora/shared'
import { db, reminderPreferences } from '../db/index.js'

const DEFAULTS = { mealReminderEnabled: false, mealReminderTime: '12:00', weightReminderEnabled: false, weightReminderTime: '08:00' }

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/reminders', { onRequest: [fastify.authenticate] }, async (request) => {
    const [preferences] = await db.select().from(reminderPreferences).where(eq(reminderPreferences.userId, request.userId)).limit(1)
    return { preferences: preferences ?? DEFAULTS }
  })

  fastify.put('/reminders', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = ReminderPreferencesSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [preferences] = await db.insert(reminderPreferences).values({ userId: request.userId, ...parsed.data }).onConflictDoUpdate({
      target: reminderPreferences.userId, set: { ...parsed.data, updatedAt: new Date() },
    }).returning()
    return { preferences }
  })
}
