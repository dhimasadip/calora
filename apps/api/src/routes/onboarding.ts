import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { CreateUserProfileSchema, UpdateUserProfileSchema, calculateAgeFromDOB, calculateBMR, calculateDailyTarget, calculateMacroTargets, calculateTDEE, type UpdateUserProfileInput } from '@calora/shared'
import { db, userProfiles, users } from '../db/index.js'

type ProfileRow = typeof userProfiles.$inferSelect

export function deriveProfileValues(data: Omit<UpdateUserProfileInput, 'dailyCalorieTarget' | 'dailyTargetMode'> & { dailyCalorieTarget?: number; dailyTargetMode?: 'auto' | 'custom' }, existing?: ProfileRow) {
  const merged = {
    dateOfBirth: data.dateOfBirth ?? existing?.dateOfBirth,
    sex: data.sex ?? existing?.sex,
    heightCm: data.heightCm ?? existing?.heightCm,
    weightKg: data.weightKg ?? existing?.weightKg,
    activityLevel: data.activityLevel ?? existing?.activityLevel,
    goal: data.goal ?? existing?.goal,
    goalIntensity: data.goalIntensity ?? existing?.goalIntensity,
    targetWeightKg: data.targetWeightKg !== undefined ? data.targetWeightKg : existing?.targetWeightKg ?? null,
    targetDate: data.targetDate !== undefined ? data.targetDate : existing?.targetDate ?? null,
    unitPreference: data.unitPreference ?? existing?.unitPreference ?? 'metric',
  }
  if (!merged.dateOfBirth || !merged.sex || !merged.heightCm || !merged.weightKg || !merged.activityLevel || !merged.goal || !merged.goalIntensity) throw new Error('Incomplete profile data')

  const bmr = Math.round(calculateBMR(merged.weightKg, merged.heightCm, calculateAgeFromDOB(merged.dateOfBirth), merged.sex))
  const tdee = calculateTDEE(bmr, merged.activityLevel)
  const suggestedDailyCalorieTarget = calculateDailyTarget(tdee, merged.goal, merged.goalIntensity)
  const dailyTargetMode = data.dailyTargetMode ?? existing?.dailyTargetMode ?? 'auto'
  const dailyCalorieTarget = dailyTargetMode === 'auto' ? suggestedDailyCalorieTarget : data.dailyCalorieTarget ?? existing?.dailyCalorieTarget ?? suggestedDailyCalorieTarget
  const macros = calculateMacroTargets(dailyCalorieTarget)

  return {
    dateOfBirth: merged.dateOfBirth!, sex: merged.sex!, heightCm: merged.heightCm!, weightKg: merged.weightKg!,
    activityLevel: merged.activityLevel!, goal: merged.goal!, goalIntensity: merged.goalIntensity!,
    targetWeightKg: merged.targetWeightKg, targetDate: merged.targetDate, unitPreference: merged.unitPreference,
    bmr, tdee, suggestedDailyCalorieTarget, dailyCalorieTarget, dailyTargetMode, ...macros,
  }
}

export const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = CreateUserProfileSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const values = deriveProfileValues(parsed.data)
    const [[profile]] = await Promise.all([
      db.insert(userProfiles).values({ userId: request.userId, ...values }).onConflictDoUpdate({ target: userProfiles.userId, set: { ...values, updatedAt: new Date() } }).returning(),
      db.update(users).set({ onboardingComplete: true, updatedAt: new Date() }).where(eq(users.id, request.userId)),
    ])
    return reply.status(201).send({ profile })
  })

  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    if (!profile) return reply.status(404).send({ error: 'Profile not found. Complete onboarding first.' })
    return reply.send({ profile })
  })

  fastify.patch('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = UpdateUserProfileSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Profile not found. Complete onboarding first.' })
    const values = deriveProfileValues(parsed.data, existing)
    const [profile] = await db.update(userProfiles).set({ ...values, updatedAt: new Date() }).where(eq(userProfiles.userId, request.userId)).returning()
    return reply.send({ profile })
  })
}
