import type { FastifyPluginAsync } from 'fastify'
import { db, users, userProfiles } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { CreateUserProfileSchema, UpdateUserProfileSchema, calculateBMR, calculateTDEE, calculateDailyTarget, calculateMacroTargets, calculateAgeFromDOB } from '@calora/shared'

export const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/profile — create profile + calculate TDEE
  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = CreateUserProfileSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }
    const data = result.data
    const age = calculateAgeFromDOB(data.dateOfBirth)
    const bmr = Math.round(calculateBMR(data.weightKg, data.heightCm, age, data.sex))
    const tdee = calculateTDEE(bmr, data.activityLevel)
    const dailyCalorieTarget = calculateDailyTarget(tdee, data.goal, data.goalIntensity)
    const macros = calculateMacroTargets(dailyCalorieTarget)

    const sharedValues = {
      dateOfBirth: data.dateOfBirth,
      sex: data.sex,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      activityLevel: data.activityLevel,
      goal: data.goal,
      goalIntensity: data.goalIntensity,
      targetWeightKg: data.targetWeightKg ?? null,
      bmr,
      tdee,
      dailyCalorieTarget,
      proteinTargetG: macros.proteinTargetG,
      carbsTargetG: macros.carbsTargetG,
      fatTargetG: macros.fatTargetG,
      unitPreference: data.unitPreference,
    }

    const [[profile]] = await Promise.all([
      db
        .insert(userProfiles)
        .values({ userId: request.userId, ...sharedValues })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: { ...sharedValues, updatedAt: new Date() },
        })
        .returning(),
      db.update(users).set({ onboardingComplete: true }).where(eq(users.id, request.userId)),
    ])

    return reply.status(201).send({ profile })
  })

  // PATCH /api/v1/profile — update profile
  fastify.patch('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = UpdateUserProfileSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }
    const data = result.data

    const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Profile not found. Complete onboarding first.' })

    const merged = {
      dateOfBirth: data.dateOfBirth ?? existing.dateOfBirth,
      sex: data.sex ?? existing.sex,
      heightCm: data.heightCm ?? existing.heightCm,
      weightKg: data.weightKg ?? existing.weightKg,
      activityLevel: data.activityLevel ?? existing.activityLevel,
      goal: data.goal ?? existing.goal,
      goalIntensity: data.goalIntensity ?? existing.goalIntensity,
      targetWeightKg: data.targetWeightKg !== undefined ? (data.targetWeightKg ?? null) : existing.targetWeightKg,
      unitPreference: data.unitPreference ?? existing.unitPreference,
    }

    const age = calculateAgeFromDOB(merged.dateOfBirth)
    const bmr = Math.round(calculateBMR(merged.weightKg, merged.heightCm, age, merged.sex))
    const tdee = calculateTDEE(bmr, merged.activityLevel)
    const dailyCalorieTarget = calculateDailyTarget(tdee, merged.goal, merged.goalIntensity)
    const macros = calculateMacroTargets(dailyCalorieTarget)

    const [profile] = await db
      .update(userProfiles)
      .set({
        ...merged,
        bmr,
        tdee,
        dailyCalorieTarget,
        proteinTargetG: macros.proteinTargetG,
        carbsTargetG: macros.carbsTargetG,
        fatTargetG: macros.fatTargetG,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, request.userId))
      .returning()

    return reply.send({ profile })
  })

  // GET /api/v1/profile
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, request.userId)).limit(1)
    if (!profile) return reply.status(404).send({ error: 'Profile not found' })
    return reply.send({ profile })
  })
}
