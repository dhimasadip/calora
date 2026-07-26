import type { FastifyPluginAsync } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { CoachMessageSchema, ExerciseEstimateRequestSchema, ExerciseEstimateSchema, FoodEstimateRequestSchema, FoodEstimateSchema } from '@calora/shared'
import { db, agentMessages, exerciseEntries, foodEntries, userProfiles, users } from '../db/index.js'
import { assertOpenAiConfigured, cacheEstimate, consumeAiInvocation, getAiUsage, getCachedEstimate, normalizedHash, openai, openAiEnv } from '../lib/openai.js'
import { generateId, toDateStr } from '../lib/utils.js'

const FOOD_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'quantity', 'unit', 'calories', 'proteinG', 'carbsG', 'fatG', 'mealType', 'confidence', 'rationale'],
  properties: {
    name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, calories: { type: 'integer' },
    proteinG: { type: 'number' }, carbsG: { type: 'number' }, fatG: { type: 'number' },
    mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] }, confidence: { type: 'number' }, rationale: { type: 'string' },
  },
}

const EXERCISE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'workoutType', 'durationMinutes', 'intensity', 'caloriesBurned', 'confidence', 'rationale'],
  properties: {
    name: { type: 'string' }, workoutType: { type: 'string' }, durationMinutes: { type: 'integer' },
    intensity: { type: 'string', enum: ['low', 'moderate', 'high'] }, caloriesBurned: { type: 'integer' }, confidence: { type: 'number' }, rationale: { type: 'string' },
  },
}

async function estimate(userId: string, kind: 'food' | 'exercise', description: string, profile: typeof userProfiles.$inferSelect | undefined, mealType?: string) {
  const profileKey = kind === 'exercise' ? `${profile?.weightKg ?? 70}` : ''
  const inputHash = normalizedHash(kind, description, mealType ?? '', profileKey)
  const cached = await getCachedEstimate<unknown>(userId, kind, inputHash)
  if (cached) return { estimate: kind === 'food' ? FoodEstimateSchema.parse(cached) : ExerciseEstimateSchema.parse(cached), cached: true, ...(await getAiUsage(userId)) }
  const usage = await consumeAiInvocation(userId)
  if (!usage.allowed) {
    const error = new Error(`Daily AI limit reached (${openAiEnv.aiDailyLimit}). Manual logging is still available.`)
    ;(error as Error & { statusCode?: number }).statusCode = 429
    throw error
  }
  assertOpenAiConfigured()
  const context = kind === 'food'
    ? `Estimate a single food entry from: ${description}. ${mealType ? `Use meal type ${mealType}.` : 'Choose the most likely meal type.'}`
    : `Estimate a single workout from: ${description}. User weight is ${profile?.weightKg ?? 70} kg. Use MET-informed reasoning.`
  const instruction = `You estimate nutrition and exercise for Calora. Return only the requested structured data. Values are approximate, conservative, non-medical estimates. Do not give health advice. ${context}`
  const response = await openai.responses.create({
    model: openAiEnv.openaiModel,
    input: [{ role: 'user', content: [{ type: 'input_text', text: instruction }] }],
    text: { format: { type: 'json_schema', name: `${kind}_estimate`, strict: true, schema: kind === 'food' ? FOOD_SCHEMA : EXERCISE_SCHEMA } },
  } as never) as unknown as { output_text: string }
  const parsed = kind === 'food' ? FoodEstimateSchema.parse(JSON.parse(response.output_text)) : ExerciseEstimateSchema.parse(JSON.parse(response.output_text))
  await cacheEstimate(userId, kind, inputHash, parsed)
  return { estimate: parsed, cached: false, limit: openAiEnv.aiDailyLimit, used: openAiEnv.aiDailyLimit - usage.remaining, remaining: usage.remaining }
}

async function coachContext(userId: string) {
  const today = toDateStr()
  const [user, profile, foods, exercises] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1).then(([row]) => row),
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1).then(([row]) => row),
    db.select().from(foodEntries).where(and(eq(foodEntries.userId, userId), eq(foodEntries.date, today))).orderBy(asc(foodEntries.loggedAt)),
    db.select().from(exerciseEntries).where(and(eq(exerciseEntries.userId, userId), eq(exerciseEntries.date, today))).orderBy(asc(exerciseEntries.loggedAt)),
  ])
  const intake = foods.reduce((total, entry) => total + entry.calories, 0)
  const burned = exercises.reduce((total, entry) => total + entry.caloriesBurned, 0)
  return `You are Calora's friendly nutrition coach. You cannot save, edit, or delete entries. Direct users to the Add food or Add workout actions for an editable estimate. Never give medical advice. Homemade food estimates are approximate.\nUser: ${user?.displayName ?? 'Calora member'}\nToday: ${today}; intake ${intake} kcal; burned ${burned} kcal; target ${profile?.dailyCalorieTarget ?? 2000} kcal.`
}

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  const rateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }
  fastify.get('/usage', { onRequest: [fastify.authenticate] }, async (request) => getAiUsage(request.userId))
  fastify.post('/food-estimate', { onRequest: [fastify.authenticate], ...rateLimit }, async (request, reply) => {
    const parsed = FoodEstimateRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    try { return reply.send(await estimate(request.userId, 'food', parsed.data.description, profile, parsed.data.mealType)) }
    catch (error) { return reply.status((error as Error & { statusCode?: number }).statusCode ?? 502).send({ error: (error as Error).message || 'Unable to create estimate' }) }
  })

  fastify.post('/exercise-estimate', { onRequest: [fastify.authenticate], ...rateLimit }, async (request, reply) => {
    const parsed = ExerciseEstimateRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    try { return reply.send(await estimate(request.userId, 'exercise', parsed.data.description, profile)) }
    catch (error) { return reply.status((error as Error & { statusCode?: number }).statusCode ?? 502).send({ error: (error as Error).message || 'Unable to create estimate' }) }
  })

  fastify.post('/coach', { onRequest: [fastify.authenticate], ...rateLimit }, async (request, reply) => {
    const parsed = CoachMessageSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    try {
      const usage = await consumeAiInvocation(request.userId)
      if (!usage.allowed) return reply.status(429).send({ error: `Daily AI limit reached (${openAiEnv.aiDailyLimit}).` })
      assertOpenAiConfigured()
      const [history, system] = await Promise.all([
        db.select().from(agentMessages).where(and(eq(agentMessages.userId, request.userId), eq(agentMessages.sessionId, parsed.data.sessionId))).orderBy(asc(agentMessages.createdAt)).limit(16),
        coachContext(request.userId),
      ])
      reply.raw.setHeader('Content-Type', 'text/event-stream'); reply.raw.setHeader('Cache-Control', 'no-cache'); reply.raw.setHeader('Connection', 'keep-alive'); reply.raw.flushHeaders()
      const stream = await openai.responses.create({
        model: openAiEnv.openaiModel,
        input: [{ role: 'system', content: [{ type: 'input_text', text: system }] }, ...history.map((message) => ({ role: message.role, content: [{ type: 'input_text', text: message.content }] })), { role: 'user', content: [{ type: 'input_text', text: parsed.data.content }] }],
        stream: true,
      } as never) as unknown as AsyncIterable<{ type: string; delta?: string }>
      let responseText = ''
      for await (const event of stream) if (event.type === 'response.output_text.delta' && event.delta) { responseText += event.delta; reply.raw.write(`event: delta\ndata: ${JSON.stringify({ text: event.delta })}\n\n`) }
      await db.insert(agentMessages).values([
        { id: generateId(), userId: request.userId, sessionId: parsed.data.sessionId, role: 'user', content: parsed.data.content },
        { id: generateId(), userId: request.userId, sessionId: parsed.data.sessionId, role: 'assistant', content: responseText },
      ])
      reply.raw.write(`event: done\ndata: ${JSON.stringify({ limit: openAiEnv.aiDailyLimit, used: openAiEnv.aiDailyLimit - usage.remaining, remaining: usage.remaining })}\n\n`); reply.raw.end()
    } catch (error) {
      if (!reply.raw.headersSent) return reply.status((error as Error & { statusCode?: number }).statusCode ?? 502).send({ error: (error as Error).message || 'Unable to reach the coach' })
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: (error as Error).message || 'Unable to reach the coach' })}\n\n`); reply.raw.end()
    }
  })
}
