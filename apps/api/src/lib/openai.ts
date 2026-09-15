import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db, aiEstimateCache, aiUsageDaily, aiUsageLogs } from '../db/index.js'
import { loadEnv } from './env.js'
import { computeAiUsage } from './ai-cost.js'
import { generateId, toDateStr } from './utils.js'

const env = loadEnv()

// The SDK remains server-only. A blank development key makes startup possible without
// credentials; actual estimate calls return a clear configuration error below.
// When OPENAI_BASE_URL is set, the client targets any OpenAI-compatible provider
// (Azure, OpenRouter, a local proxy, etc.); otherwise it falls back to the SDK
// default (api.openai.com).
export const openai = new OpenAI({
  apiKey: env.openaiApiKey || 'development-key',
  ...(env.openaiBaseUrl ? { baseURL: env.openaiBaseUrl } : {}),
})

export function normalizedHash(...parts: string[]): string {
  return createHash('sha256').update(parts.map((part) => part.trim().toLowerCase()).join('\n')).digest('hex')
}

export async function getCachedEstimate<T>(userId: string, kind: 'food' | 'exercise', inputHash: string): Promise<T | null> {
  const [cached] = await db.select().from(aiEstimateCache).where(and(
    eq(aiEstimateCache.userId, userId), eq(aiEstimateCache.kind, kind), eq(aiEstimateCache.inputHash, inputHash), gt(aiEstimateCache.expiresAt, new Date()),
  )).limit(1)
  return (cached?.response as T | undefined) ?? null
}

export async function cacheEstimate(userId: string, kind: 'food' | 'exercise', inputHash: string, response: unknown) {
  const expiresAt = new Date(Date.now() + env.aiCacheTtlHours * 60 * 60 * 1000)
  await db.insert(aiEstimateCache).values({ id: generateId(), userId, kind, inputHash, response, expiresAt }).onConflictDoUpdate({
    target: [aiEstimateCache.userId, aiEstimateCache.kind, aiEstimateCache.inputHash], set: { response, expiresAt, createdAt: new Date() },
  })
}

export async function getAiUsage(userId: string) {
  const today = toDateStr()
  const [usage] = await db.select().from(aiUsageDaily).where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.date, today))).limit(1)
  const used = Math.min(usage?.invocationCount ?? 0, env.aiDailyLimit)
  return { limit: env.aiDailyLimit, used, remaining: Math.max(0, env.aiDailyLimit - used) }
}

export async function consumeAiInvocation(userId: string) {
  const today = toDateStr()
  const [usage] = await db.select().from(aiUsageDaily).where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.date, today))).limit(1)
  if (usage && usage.invocationCount >= env.aiDailyLimit) return { allowed: false, remaining: 0 }
  const count = (usage?.invocationCount ?? 0) + 1
  if (usage) {
    await db.update(aiUsageDaily).set({ invocationCount: count, updatedAt: new Date() }).where(eq(aiUsageDaily.id, usage.id))
  } else {
    await db.insert(aiUsageDaily).values({ id: generateId(), userId, date: today, invocationCount: count })
  }
  return { allowed: true, remaining: Math.max(0, env.aiDailyLimit - count) }
}

// Returns one invocation to the daily quota when a request was counted but failed
// before delivering a result, so failed requests don't burn the daily allowance.
export async function refundAiInvocation(userId: string) {
  const today = toDateStr()
  const [usage] = await db.select().from(aiUsageDaily).where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.date, today))).limit(1)
  if (!usage) return
  const count = Math.max(0, (usage.invocationCount ?? 0) - 1)
  await db.update(aiUsageDaily).set({ invocationCount: count, updatedAt: new Date() }).where(eq(aiUsageDaily.id, usage.id))
}

export function assertOpenAiConfigured() {
  if (!env.openaiApiKey) {
    const error = new Error('AI estimates are not configured. Add OPENAI_API_KEY to enable them.')
    ;(error as Error & { statusCode?: number }).statusCode = 503
    throw error
  }
}

export async function recordAiUsage(userId: string, kind: 'food_estimate' | 'exercise_estimate' | 'coach', model: string, usage: unknown) {
  const record = computeAiUsage(usage)
  if (!record) return
  try {
    await db.insert(aiUsageLogs).values({ id: generateId(), userId, kind, model, ...record })
  } catch (error) {
    // Accounting must never break a successful AI response; quota tracking stays intact.
    console.error('Failed to record AI usage', error)
  }
}

export { env as openAiEnv }
