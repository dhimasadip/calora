import { describe, expect, it } from 'vitest'
import { ExerciseEstimateSchema, FoodEstimateSchema } from '@calora/shared'

describe('AI estimate response contracts', () => {
  it('accepts editable food and workout drafts without persistence fields', () => {
    expect(FoodEstimateSchema.safeParse({ name: 'Eggs on toast', quantity: 1, unit: 'plate', calories: 420, proteinG: 22, carbsG: 32, fatG: 22, mealType: 'breakfast', confidence: .72, rationale: 'Typical portions.' }).success).toBe(true)
    expect(ExerciseEstimateSchema.safeParse({ name: '5K run', workoutType: 'running', durationMinutes: 30, intensity: 'high', caloriesBurned: 340, confidence: .76, rationale: 'MET-based approximation.' }).success).toBe(true)
  })
})
