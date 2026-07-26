import type { FastifyPluginAsync } from 'fastify'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db, exerciseEntries, foodEntries, userProfiles, weightLogs } from '../db/index.js'
import { isDateStr, shiftDateStr, toDateStr } from '../lib/utils.js'

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { from?: string; to?: string }
    const today = toDateStr()
    let from = isDateStr(query.from) ? query.from : today
    let to = isDateStr(query.to) ? query.to : from
    if (from > to) [from, to] = [to, from]
    const totalDays = daysBetween(from, to)
    if (totalDays > 366) return reply.status(400).send({ error: 'Reports are limited to 366 days at a time' })

    const [profile, foods, exercises, weights] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1).then(([row]) => row),
      db.select().from(foodEntries).where(and(eq(foodEntries.userId, request.userId), gte(foodEntries.date, from), lte(foodEntries.date, to))).orderBy(asc(foodEntries.loggedAt)),
      db.select().from(exerciseEntries).where(and(eq(exerciseEntries.userId, request.userId), gte(exerciseEntries.date, from), lte(exerciseEntries.date, to))).orderBy(asc(exerciseEntries.loggedAt)),
      db.select().from(weightLogs).where(and(eq(weightLogs.userId, request.userId), gte(weightLogs.date, from), lte(weightLogs.date, to))).orderBy(asc(weightLogs.date)),
    ])
    const target = profile?.dailyCalorieTarget ?? 2000
    const proteinTarget = profile?.proteinTargetG ?? 0
    const carbsTarget = profile?.carbsTargetG ?? 0
    const fatTarget = profile?.fatTargetG ?? 0
    const perDay = new Map<string, { caloriesIn: number; caloriesBurned: number }>()
    for (let i = 0; i < totalDays; i++) perDay.set(shiftDateStr(from, i), { caloriesIn: 0, caloriesBurned: 0 })
    let caloriesIn = 0, caloriesBurned = 0, proteinG = 0, carbsG = 0, fatG = 0
    for (const entry of foods) {
      caloriesIn += entry.calories; proteinG += entry.proteinG; carbsG += entry.carbsG; fatG += entry.fatG
      const bucket = perDay.get(entry.date); if (bucket) bucket.caloriesIn += entry.calories
    }
    for (const entry of exercises) {
      caloriesBurned += entry.caloriesBurned
      const bucket = perDay.get(entry.date); if (bucket) bucket.caloriesBurned += entry.caloriesBurned
    }
    const targetCalories = target * totalDays
    return {
      summary: {
        from, to, days: totalDays, caloriesIn, caloriesBurned, netCalories: caloriesIn - caloriesBurned,
        targetCalories, remaining: targetCalories - (caloriesIn - caloriesBurned),
        proteinG: Math.round(proteinG * 10) / 10, carbsG: Math.round(carbsG * 10) / 10, fatG: Math.round(fatG * 10) / 10,
        proteinTargetG: proteinTarget * totalDays, carbsTargetG: carbsTarget * totalDays, fatTargetG: fatTarget * totalDays,
        daily: [...perDay.entries()].map(([date, values]) => ({ date, ...values, netCalories: values.caloriesIn - values.caloriesBurned, target })),
        weightLogs: weights,
      },
    }
  })
}
