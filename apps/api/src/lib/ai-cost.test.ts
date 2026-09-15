import { describe, expect, it } from 'vitest'
import { computeAiUsage } from './ai-cost.js'

describe('computeAiUsage', () => {
  it('prices cache hits at the discounted rate and misses at the standard rate', () => {
    const record = computeAiUsage({
      prompt_tokens: 10_000,
      completion_tokens: 1_000,
      total_tokens: 11_000,
      prompt_cache_hit_tokens: 4_000,
      prompt_cache_miss_tokens: 6_000,
    })
    expect(record).not.toBeNull()
    expect(record?.promptCacheHitTokens).toBe(4_000)
    expect(record?.promptCacheMissTokens).toBe(6_000)
    expect(record?.costUsd).toBeCloseTo((6_000 / 1_000_000) * 0.27 + (4_000 / 1_000_000) * 0.07 + (1_000 / 1_000_000) * 1.10, 6)
  })

  it('falls back to pricing the whole prompt at the standard rate when cache fields are absent', () => {
    const record = computeAiUsage({ prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 })
    expect(record?.promptCacheHitTokens).toBe(0)
    expect(record?.promptCacheMissTokens).toBe(500)
    expect(record?.costUsd).toBeCloseTo((500 / 1_000_000) * 0.27 + (100 / 1_000_000) * 1.10, 6)
  })

  it('returns null for missing or empty usage', () => {
    expect(computeAiUsage(undefined)).toBeNull()
    expect(computeAiUsage(null)).toBeNull()
    expect(computeAiUsage({ prompt_tokens: 0, completion_tokens: 0 })).toBeNull()
  })
})
