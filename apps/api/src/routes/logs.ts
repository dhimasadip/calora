import type { FastifyPluginAsync } from 'fastify'
import { db, foodLogs, workoutLogs, userProfiles } from '../db/index.js'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { CreateFoodLogSchema, UpdateFoodLogSchema, CreateWorkoutLogSchema, calculateMacroTargets } from '@calora/shared'
import { generateId, toDateStr, shiftDateStr, isDateStr, resolveEntryDate } from '../lib/utils.js'

export const logsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Food Logs ──────────────────────────────────────────────────────────────

  fastify.post('/food', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = CreateFoodLogSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    const data = result.data

    const resolved = data.loggedAt
      ? { date: data.date ?? toDateStr(new Date(data.loggedAt)), loggedAt: new Date(data.loggedAt) }
      : resolveEntryDate(data.date)

    const [log] = await db
      .insert(foodLogs)
      .values({
        id: generateId(),
        userId: request.userId,
        description: data.description,
        calories: data.calories,
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        mealType: data.mealType,
        source: data.source,
        rawInput: data.rawInput ?? null,
        date: resolved.date,
        loggedAt: resolved.loggedAt,
      })
      .returning()

    return reply.status(201).send({ log })
  })

  fastify.get('/food', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { date } = request.query as { date?: string }
    const targetDate = isDateStr(date) ? date : toDateStr(new Date())

    const logs = await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, request.userId), eq(foodLogs.date, targetDate)))
      .orderBy(foodLogs.loggedAt)

    return reply.send({ logs })
  })

  fastify.patch('/food/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = UpdateFoodLogSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten().fieldErrors })

    const data = result.data
    const updated = await db
      .update(foodLogs)
      .set({
        ...(data.description !== undefined && { description: data.description }),
        ...(data.calories !== undefined && { calories: data.calories }),
        ...(data.proteinG !== undefined && { proteinG: data.proteinG }),
        ...(data.carbsG !== undefined && { carbsG: data.carbsG }),
        ...(data.fatG !== undefined && { fatG: data.fatG }),
        ...(data.mealType !== undefined && { mealType: data.mealType }),
        ...(data.date !== undefined && { date: data.date }),
      })
      .where(and(eq(foodLogs.id, id), eq(foodLogs.userId, request.userId)))
      .returning()

    if (updated.length === 0) return reply.status(404).send({ error: 'Log not found' })
    return reply.send({ log: updated[0] })
  })

  fastify.delete('/food/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await db
      .delete(foodLogs)
      .where(and(eq(foodLogs.id, id), eq(foodLogs.userId, request.userId)))
      .returning({ id: foodLogs.id })

    if (deleted.length === 0) return reply.status(404).send({ error: 'Log not found' })
    return reply.send({ ok: true })
  })

  // ── Workout Logs ────────────────────────────────────────────────────────────

  fastify.post('/workout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = CreateWorkoutLogSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    const data = result.data

    const resolved = data.loggedAt
      ? { date: data.date ?? toDateStr(new Date(data.loggedAt)), loggedAt: new Date(data.loggedAt) }
      : resolveEntryDate(data.date)

    const [log] = await db
      .insert(workoutLogs)
      .values({
        id: generateId(),
        userId: request.userId,
        description: data.description,
        workoutType: data.workoutType,
        durationMinutes: data.durationMinutes,
        caloriesBurned: data.caloriesBurned,
        source: data.source,
        rawInput: data.rawInput ?? null,
        date: resolved.date,
        loggedAt: resolved.loggedAt,
      })
      .returning()

    return reply.status(201).send({ log })
  })

  fastify.get('/workout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { date } = request.query as { date?: string }
    const targetDate = isDateStr(date) ? date : toDateStr(new Date())

    const logs = await db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, request.userId), eq(workoutLogs.date, targetDate)))
      .orderBy(workoutLogs.loggedAt)

    return reply.send({ logs })
  })

  fastify.delete('/workout/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await db
      .delete(workoutLogs)
      .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, request.userId)))
      .returning({ id: workoutLogs.id })

    if (deleted.length === 0) return reply.status(404).send({ error: 'Log not found' })
    return reply.send({ ok: true })
  })

  // ── Daily Summary ───────────────────────────────────────────────────────────

  fastify.get('/summary', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { date } = request.query as { date?: string }
    const targetDate = isDateStr(date) ? date : toDateStr(new Date())

    const [profileRows, food, workouts] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1),
      db.select().from(foodLogs)
        .where(and(eq(foodLogs.userId, request.userId), eq(foodLogs.date, targetDate)))
        .orderBy(foodLogs.loggedAt),
      db.select().from(workoutLogs)
        .where(and(eq(workoutLogs.userId, request.userId), eq(workoutLogs.date, targetDate)))
        .orderBy(workoutLogs.loggedAt),
    ])

    const dailyTarget = profileRows[0]?.dailyCalorieTarget ?? 2000
    const caloriesIn = food.reduce((sum, f) => sum + f.calories, 0)
    const caloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0)
    const netCalories = caloriesIn - caloriesBurned
    const proteinG = food.reduce((sum, f) => sum + f.proteinG, 0)
    const carbsG = food.reduce((sum, f) => sum + f.carbsG, 0)
    const fatG = food.reduce((sum, f) => sum + f.fatG, 0)

    return reply.send({
      summary: {
        date: targetDate,
        caloriesIn,
        caloriesBurned,
        netCalories,
        dailyTarget,
        remaining: dailyTarget - netCalories,
        proteinG: Math.round(proteinG * 10) / 10,
        carbsG: Math.round(carbsG * 10) / 10,
        fatG: Math.round(fatG * 10) / 10,
        foodLogs: food,
        workoutLogs: workouts,
      },
    })
  })

  // ── Weekly Summary ──────────────────────────────────────────────────────────

  fastify.get('/weekly', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const todayStr = toDateStr(new Date())
    const weekStart = shiftDateStr(todayStr, -6)

    const [profileRows, foodByDay, workoutByDay] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1),
      db
        .select({
          day: foodLogs.date,
          calories: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)::int`.as('calories'),
        })
        .from(foodLogs)
        .where(and(eq(foodLogs.userId, request.userId), gte(foodLogs.date, weekStart), lte(foodLogs.date, todayStr)))
        .groupBy(foodLogs.date),
      db
        .select({
          day: workoutLogs.date,
          caloriesBurned: sql<number>`COALESCE(SUM(${workoutLogs.caloriesBurned}), 0)::int`.as('caloriesBurned'),
        })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, request.userId), gte(workoutLogs.date, weekStart), lte(workoutLogs.date, todayStr)))
        .groupBy(workoutLogs.date),
    ])

    const dailyTarget = profileRows[0]?.dailyCalorieTarget ?? 2000

    const foodMap = new Map<string, number>()
    for (const row of foodByDay) foodMap.set(row.day, Number(row.calories))
    const workoutMap = new Map<string, number>()
    for (const row of workoutByDay) workoutMap.set(row.day, Number(row.caloriesBurned))

    const days = []
    for (let i = 6; i >= 0; i--) {
      const key = shiftDateStr(todayStr, -i)
      const caloriesIn = foodMap.get(key) ?? 0
      const caloriesBurned = workoutMap.get(key) ?? 0
      days.push({ date: key, caloriesIn, caloriesBurned, netCalories: caloriesIn - caloriesBurned, target: dailyTarget })
    }

    return reply.send({ weekly: { days } })
  })

  // ── Date-range Summary ────────────────────────────────────────────────────────

  fastify.get('/range', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string }
    const todayStr = toDateStr(new Date())
    let from = isDateStr(q.from) ? q.from : todayStr
    let to = isDateStr(q.to) ? q.to : todayStr
    if (from > to) {
      const tmp = from
      from = to
      to = tmp
    }
    const dayCount =
      Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000)) + 1

    const [profileRows, food, workouts] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1),
      db.select().from(foodLogs)
        .where(and(eq(foodLogs.userId, request.userId), gte(foodLogs.date, from), lte(foodLogs.date, to)))
        .orderBy(foodLogs.loggedAt),
      db.select().from(workoutLogs)
        .where(and(eq(workoutLogs.userId, request.userId), gte(workoutLogs.date, from), lte(workoutLogs.date, to)))
        .orderBy(workoutLogs.loggedAt),
    ])

    console.log(food)

    const profile = profileRows[0]
    const dailyTarget = profile?.dailyCalorieTarget ?? 2000
    const fallback = calculateMacroTargets(dailyTarget)
    const proteinTargetDaily = profile?.proteinTargetG ? profile.proteinTargetG : fallback.proteinTargetG
    const carbsTargetDaily = profile?.carbsTargetG ? profile.carbsTargetG : fallback.carbsTargetG
    const fatTargetDaily = profile?.fatTargetG ? profile.fatTargetG : fallback.fatTargetG

    // Seed a bucket for every day in the range so empty days still appear on the chart.
    const dailyMap = new Map<string, { caloriesIn: number; caloriesBurned: number }>()
    for (let i = 0; i < dayCount; i++) {
      dailyMap.set(shiftDateStr(from, i), { caloriesIn: 0, caloriesBurned: 0 })
    }

    let caloriesIn = 0
    let proteinG = 0
    let carbsG = 0
    let fatG = 0
    for (const f of food) {
      caloriesIn += f.calories
      proteinG += f.proteinG
      carbsG += f.carbsG
      fatG += f.fatG
      const bucket = dailyMap.get(f.date)
      if (bucket) bucket.caloriesIn += f.calories
    }

    let caloriesBurned = 0
    for (const w of workouts) {
      caloriesBurned += w.caloriesBurned
      const bucket = dailyMap.get(w.date)
      if (bucket) bucket.caloriesBurned += w.caloriesBurned
    }

    const daily = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        caloriesIn: v.caloriesIn,
        caloriesBurned: v.caloriesBurned,
        netCalories: v.caloriesIn - v.caloriesBurned,
        target: dailyTarget,
      }))

    return reply.send({
      range: {
        from,
        to,
        days: dayCount,
        caloriesIn,
        caloriesBurned,
        netCalories: caloriesIn - caloriesBurned,
        proteinG: Math.round(proteinG * 10) / 10,
        carbsG: Math.round(carbsG * 10) / 10,
        fatG: Math.round(fatG * 10) / 10,
        netTarget: dailyTarget * dayCount,
        proteinTargetG: proteinTargetDaily * dayCount,
        carbsTargetG: carbsTargetDaily * dayCount,
        fatTargetG: fatTargetDaily * dayCount,
        daily,
        foodLogs: food,
        workoutLogs: workouts,
      },
    })
  })
}
