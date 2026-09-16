import { describe, expect, it } from 'vitest'
import { ExerciseEstimateSchema, FoodEstimateSchema } from '@calora/shared'
import { parseScopeResponse, scopeRefusalMessage } from '../lib/scope.js'

describe('AI estimate response contracts', () => {
  it('accepts editable food and workout drafts without persistence fields', () => {
    expect(FoodEstimateSchema.safeParse({ name: 'Eggs on toast', quantity: 1, unit: 'plate', calories: 420, proteinG: 22, carbsG: 32, fatG: 22, mealType: 'breakfast', confidence: .72, rationale: 'Typical portions.' }).success).toBe(true)
    expect(ExerciseEstimateSchema.safeParse({ name: '5K run', workoutType: 'running', durationMinutes: 30, intensity: 'high', caloriesBurned: 340, confidence: .76, rationale: 'MET-based approximation.' }).success).toBe(true)
  })
})

describe('coach scope classifier parsing', () => {
  it('accepts an in-scope response', () => {
    expect(parseScopeResponse('{"inScope":true}')).toBe(true)
  })

  it('rejects an out-of-scope response', () => {
    expect(parseScopeResponse('{"inScope":false}')).toBe(false)
  })

  it('fails closed on malformed or missing responses', () => {
    expect(parseScopeResponse('')).toBe(false)
    expect(parseScopeResponse('not json')).toBe(false)
    expect(parseScopeResponse('{}')).toBe(false)
    expect(parseScopeResponse('{"inScope":"true"}')).toBe(false)
  })
})

describe('estimate scope refusal messages', () => {
  it('returns kind-specific refusals', () => {
    expect(scopeRefusalMessage('food')).toContain('food or meal')
    expect(scopeRefusalMessage('exercise')).toContain('workout')
  })
})
