import type { FastifyPluginAsync } from 'fastify'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { CreateExerciseEntrySchema, CreateFoodEntrySchema, UpdateExerciseEntrySchema, UpdateFoodEntrySchema } from '@calora/shared'
import { db, exerciseEntries, foodEntries } from '../db/index.js'
import { cachedIdempotentResponse, storeIdempotentResponse } from '../lib/idempotency.js'
import { generateId, isDateStr, resolveEntryDate, toDateStr } from '../lib/utils.js'

function dateRange(query: unknown) {
  const { from, to, date } = (query ?? {}) as { from?: string; to?: string; date?: string }
  const today = toDateStr()
  const start = isDateStr(from) ? from : isDateStr(date) ? date : today
  const end = isDateStr(to) ? to : start
  return start <= end ? { from: start, to: end } : { from: end, to: start }
}

function idempotencyKey(headers: Record<string, unknown>) {
  const key = headers['idempotency-key']
  return typeof key === 'string' && key.length <= 255 ? key : undefined
}

export const entriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/food-entries', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const cached = await cachedIdempotentResponse(request.userId, idempotencyKey(request.headers))
    if (cached) return reply.status(cached.statusCode).send(cached.response)
    const parsed = CreateFoodEntrySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const data = parsed.data
    const loggedAt = data.loggedAt ? new Date(data.loggedAt) : undefined
    const resolved = loggedAt ? { date: data.date ?? toDateStr(loggedAt), loggedAt } : resolveEntryDate(data.date)
    const [entry] = await db.insert(foodEntries).values({
      id: generateId(), userId: request.userId, date: resolved.date, loggedAt: resolved.loggedAt,
      name: data.name, quantity: data.quantity, unit: data.unit, calories: data.calories,
      proteinG: data.proteinG ?? 0, carbsG: data.carbsG ?? 0, fatG: data.fatG ?? 0,
      mealType: data.mealType, source: data.source, rawInput: data.rawInput ?? null,
    }).returning()
    const response = { entry }
    await storeIdempotentResponse(request.userId, idempotencyKey(request.headers), 201, response)
    return reply.status(201).send(response)
  })

  fastify.get('/food-entries', { onRequest: [fastify.authenticate] }, async (request) => {
    const { from, to } = dateRange(request.query)
    const entries = await db.select().from(foodEntries).where(and(eq(foodEntries.userId, request.userId), gte(foodEntries.date, from), lte(foodEntries.date, to))).orderBy(asc(foodEntries.loggedAt))
    return { entries }
  })

  fastify.patch('/food-entries/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = UpdateFoodEntrySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const expectedVersion = parsed.data.expectedVersion ?? 0
    if (expectedVersion < 1) return reply.status(400).send({ error: 'expectedVersion is required' })
    const { expectedVersion: _ignoredVersion, ...data } = parsed.data
    const id = (request.params as { id: string }).id
    const [entry] = await db.update(foodEntries).set({
      ...(data.name !== undefined && { name: data.name }), ...(data.quantity !== undefined && { quantity: data.quantity }), ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.calories !== undefined && { calories: data.calories }), ...(data.proteinG !== undefined && { proteinG: data.proteinG }), ...(data.carbsG !== undefined && { carbsG: data.carbsG }),
      ...(data.fatG !== undefined && { fatG: data.fatG }), ...(data.mealType !== undefined && { mealType: data.mealType }), ...(data.date !== undefined && { date: data.date }),
      ...(data.loggedAt !== undefined && { loggedAt: new Date(data.loggedAt) }), version: expectedVersion + 1, updatedAt: new Date(),
    }).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, request.userId), eq(foodEntries.version, expectedVersion))).returning()
    if (entry) return { entry }
    const [serverRecord] = await db.select().from(foodEntries).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, request.userId))).limit(1)
    if (!serverRecord) return reply.status(404).send({ error: 'Entry not found' })
    return reply.status(409).send({ error: 'This entry changed on another device', code: 'VERSION_CONFLICT', serverRecord })
  })

  fastify.delete('/food-entries/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const expectedVersion = (request.body as { expectedVersion?: number }).expectedVersion ?? 0
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return reply.status(400).send({ error: 'expectedVersion is required' })
    const id = (request.params as { id: string }).id
    const deleted = await db.delete(foodEntries).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, request.userId), eq(foodEntries.version, expectedVersion))).returning({ id: foodEntries.id })
    if (deleted[0]) return { ok: true }
    const [serverRecord] = await db.select().from(foodEntries).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, request.userId))).limit(1)
    if (!serverRecord) return reply.status(404).send({ error: 'Entry not found' })
    return reply.status(409).send({ error: 'This entry changed on another device', code: 'VERSION_CONFLICT', serverRecord })
  })

  fastify.post('/exercise-entries', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const cached = await cachedIdempotentResponse(request.userId, idempotencyKey(request.headers))
    if (cached) return reply.status(cached.statusCode).send(cached.response)
    const parsed = CreateExerciseEntrySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const data = parsed.data
    const loggedAt = data.loggedAt ? new Date(data.loggedAt) : undefined
    const resolved = loggedAt ? { date: data.date ?? toDateStr(loggedAt), loggedAt } : resolveEntryDate(data.date)
    const [entry] = await db.insert(exerciseEntries).values({
      id: generateId(), userId: request.userId, date: resolved.date, loggedAt: resolved.loggedAt,
      name: data.name, workoutType: data.workoutType, durationMinutes: data.durationMinutes, intensity: data.intensity,
      caloriesBurned: data.caloriesBurned, notes: data.notes ?? null, source: data.source, rawInput: data.rawInput ?? null,
    }).returning()
    const response = { entry }
    await storeIdempotentResponse(request.userId, idempotencyKey(request.headers), 201, response)
    return reply.status(201).send(response)
  })

  fastify.get('/exercise-entries', { onRequest: [fastify.authenticate] }, async (request) => {
    const { from, to } = dateRange(request.query)
    const entries = await db.select().from(exerciseEntries).where(and(eq(exerciseEntries.userId, request.userId), gte(exerciseEntries.date, from), lte(exerciseEntries.date, to))).orderBy(asc(exerciseEntries.loggedAt))
    return { entries }
  })

  fastify.patch('/exercise-entries/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = UpdateExerciseEntrySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const expectedVersion = parsed.data.expectedVersion ?? 0
    if (expectedVersion < 1) return reply.status(400).send({ error: 'expectedVersion is required' })
    const { expectedVersion: _ignoredVersion, ...data } = parsed.data
    const id = (request.params as { id: string }).id
    const [entry] = await db.update(exerciseEntries).set({
      ...(data.name !== undefined && { name: data.name }), ...(data.workoutType !== undefined && { workoutType: data.workoutType }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }), ...(data.intensity !== undefined && { intensity: data.intensity }),
      ...(data.caloriesBurned !== undefined && { caloriesBurned: data.caloriesBurned }), ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.date !== undefined && { date: data.date }), ...(data.loggedAt !== undefined && { loggedAt: new Date(data.loggedAt) }), version: expectedVersion + 1, updatedAt: new Date(),
    }).where(and(eq(exerciseEntries.id, id), eq(exerciseEntries.userId, request.userId), eq(exerciseEntries.version, expectedVersion))).returning()
    if (entry) return { entry }
    const [serverRecord] = await db.select().from(exerciseEntries).where(and(eq(exerciseEntries.id, id), eq(exerciseEntries.userId, request.userId))).limit(1)
    if (!serverRecord) return reply.status(404).send({ error: 'Entry not found' })
    return reply.status(409).send({ error: 'This entry changed on another device', code: 'VERSION_CONFLICT', serverRecord })
  })

  fastify.delete('/exercise-entries/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const expectedVersion = (request.body as { expectedVersion?: number }).expectedVersion ?? 0
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return reply.status(400).send({ error: 'expectedVersion is required' })
    const id = (request.params as { id: string }).id
    const deleted = await db.delete(exerciseEntries).where(and(eq(exerciseEntries.id, id), eq(exerciseEntries.userId, request.userId), eq(exerciseEntries.version, expectedVersion))).returning({ id: exerciseEntries.id })
    if (deleted[0]) return { ok: true }
    const [serverRecord] = await db.select().from(exerciseEntries).where(and(eq(exerciseEntries.id, id), eq(exerciseEntries.userId, request.userId))).limit(1)
    if (!serverRecord) return reply.status(404).send({ error: 'Entry not found' })
    return reply.status(409).send({ error: 'This entry changed on another device', code: 'VERSION_CONFLICT', serverRecord })
  })
}
