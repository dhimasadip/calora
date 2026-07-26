import { describe, expect, it } from 'vitest'
import { CreateFoodEntrySchema, ExerciseEstimateSchema, FoodEstimateSchema, RegisterSchema, UpdateFoodEntrySchema } from './schemas/index.js'

describe('entry and AI contracts', () => {
  it('accepts complete food entries and rejects unsafe calorie values', () => {
    expect(CreateFoodEntrySchema.safeParse({ name: 'Toast', quantity: 2, unit: 'slices', calories: 180, mealType: 'breakfast' }).success).toBe(true)
    expect(CreateFoodEntrySchema.safeParse({ name: 'Toast', quantity: 1, unit: 'slice', calories: 20001 }).success).toBe(false)
  })

  it('requires a version when editing and preserves bounded AI estimates', () => {
    expect(UpdateFoodEntrySchema.safeParse({ name: 'Corrected toast' }).success).toBe(false)
    expect(FoodEstimateSchema.safeParse({ name: 'Toast', quantity: 2, unit: 'slices', calories: 180, proteinG: 6, carbsG: 32, fatG: 2, mealType: 'breakfast', confidence: .7, rationale: 'Typical toast serving.' }).success).toBe(true)
    expect(ExerciseEstimateSchema.safeParse({ name: 'Run', workoutType: 'running', durationMinutes: 30, intensity: 'high', caloriesBurned: 300, confidence: 1.1, rationale: 'Run.' }).success).toBe(false)
  })

  it('requires strong signup passwords', () => {
    expect(RegisterSchema.safeParse({ email: 'user@example.com', displayName: 'User', password: 'Strong123' }).success).toBe(true)
    expect(RegisterSchema.safeParse({ email: 'user@example.com', displayName: 'User', password: 'lowercase123' }).success).toBe(false)
    expect(RegisterSchema.safeParse({ email: 'user@example.com', displayName: 'User', password: 'UPPERCASE123' }).success).toBe(false)
  })
})
