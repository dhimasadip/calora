import { loadEnv } from './env.js'

const env = loadEnv()

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function roundUsd(cost: number): number {
  return Math.round(cost * 1_000_000) / 1_000_000
}

export interface AiUsageRecord {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  promptCacheHitTokens: number
  promptCacheMissTokens: number
  costUsd: number
}

// DeepSeek returns prompt_cache_hit_tokens / prompt_cache_miss_tokens alongside the
// standard OpenAI usage fields. When they are absent, cached input is unknown and the
// full prompt is priced at the standard input rate.
export function computeAiUsage(usage: unknown): AiUsageRecord | null {
  if (!usage || typeof usage !== 'object') return null
  const raw = usage as Record<string, unknown>
  const promptTokens = toNumber(raw.prompt_tokens)
  const completionTokens = toNumber(raw.completion_tokens)
  if (promptTokens === 0 && completionTokens === 0) return null
  const promptCacheHitTokens = toNumber(raw.prompt_cache_hit_tokens)
  const promptCacheMissTokens = raw.prompt_cache_miss_tokens === undefined
    ? Math.max(0, promptTokens - promptCacheHitTokens)
    : toNumber(raw.prompt_cache_miss_tokens)
  const costUsd = roundUsd(
    (promptCacheMissTokens / 1_000_000) * env.aiInputPricePerM
    + (promptCacheHitTokens / 1_000_000) * env.aiInputCacheHitPricePerM
    + (completionTokens / 1_000_000) * env.aiOutputPricePerM,
  )
  return {
    promptTokens,
    completionTokens,
    totalTokens: toNumber(raw.total_tokens) || promptTokens + completionTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    costUsd,
  }
}
