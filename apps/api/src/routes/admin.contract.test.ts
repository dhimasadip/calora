import { describe, expect, it } from 'vitest'
import { AdminUsageResponseSchema } from '@calora/shared'

describe('Admin usage response contract', () => {
  it('accepts totals, per-day and per-user rows', () => {
    const response = {
      totals: {
        costUsd: 0.0042, calls: 12, promptTokens: 4000, completionTokens: 800, totalTokens: 4800, cacheHitTokens: 500, users: 2,
        byKind: { foodEstimate: 7, exerciseEstimate: 2, coach: 3 },
      },
      byDay: [{ date: '2026-09-15', costUsd: 0.0021, totalTokens: 2400, calls: 6 }],
      byUser: [{ userId: 'u1', email: 'a@example.com', displayName: 'Ada', calls: 8, promptTokens: 3000, completionTokens: 600, totalTokens: 3600, cacheHitTokens: 400, costUsd: 0.0031 }],
    }
    expect(AdminUsageResponseSchema.safeParse(response).success).toBe(true)
  })

  it('rejects rows with missing cost fields', () => {
    const response = {
      totals: {
        costUsd: 0, calls: 1, promptTokens: 10, completionTokens: 5, totalTokens: 15, cacheHitTokens: 0, users: 1,
        byKind: { foodEstimate: 1, exerciseEstimate: 0, coach: 0 },
      },
      byDay: [{ date: '2026-09-15', costUsd: 0, totalTokens: 15, calls: 1 }],
      byUser: [{ userId: 'u1', email: 'a@example.com', displayName: 'Ada', calls: 1, promptTokens: 10, completionTokens: 5, totalTokens: 15 }],
    }
    expect(AdminUsageResponseSchema.safeParse(response).success).toBe(false)
  })
})
