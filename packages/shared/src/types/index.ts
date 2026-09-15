import type { ActivityLevel, Goal, GoalIntensity, Sex } from '../calculations.js'

export type { ActivityLevel, Goal, GoalIntensity, Sex }

export type EntrySource = 'manual' | 'ai'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'
export type WorkoutIntensity = 'low' | 'moderate' | 'high'
export type DailyTargetMode = 'auto' | 'custom'

export interface User {
  id: string
  email: string
  displayName: string
  onboardingComplete: boolean
  createdAt: string
}

export interface UserProfile {
  userId: string
  dateOfBirth: string
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  goalIntensity: GoalIntensity
  targetWeightKg: number | null
  targetDate: string | null
  bmr: number
  tdee: number
  suggestedDailyCalorieTarget: number
  dailyCalorieTarget: number
  dailyTargetMode: DailyTargetMode
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  unitPreference: 'metric' | 'imperial'
  updatedAt: string
}

export interface FoodEntry {
  id: string
  userId: string
  date: string
  loggedAt: string
  name: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealType: MealType
  source: EntrySource
  rawInput: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface ExerciseEntry {
  id: string
  userId: string
  date: string
  loggedAt: string
  name: string
  workoutType: string
  durationMinutes: number
  intensity: WorkoutIntensity
  caloriesBurned: number
  notes: string | null
  source: EntrySource
  rawInput: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface WeightLog {
  id: string
  userId: string
  date: string
  weightKg: number
  version: number
  createdAt: string
  updatedAt: string
}

export interface ReminderPreferences {
  mealReminderEnabled: boolean
  mealReminderTime: string
  weightReminderEnabled: boolean
  weightReminderTime: string
}

export interface AiUsage {
  limit: number
  used: number
  remaining: number
}

export interface AdminUsageByUser {
  userId: string
  email: string
  displayName: string
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheHitTokens: number
  costUsd: number
}

export interface AdminUsageByDay {
  date: string
  costUsd: number
  totalTokens: number
  calls: number
}

export interface AdminUsageSummary {
  totals: {
    costUsd: number
    calls: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cacheHitTokens: number
    users: number
    byKind: { foodEstimate: number; exerciseEstimate: number; coach: number }
  }
  byDay: AdminUsageByDay[]
  byUser: AdminUsageByUser[]
}

export interface ReportDay {
  date: string
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  target: number
}

export interface ReportSummary {
  from: string
  to: string
  days: number
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  targetCalories: number
  remaining: number
  proteinG: number
  carbsG: number
  fatG: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  daily: ReportDay[]
  weightLogs: WeightLog[]
}

export interface FoodEstimate {
  name: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealType: MealType
  confidence: number
  rationale: string
}

export interface ExerciseEstimate {
  name: string
  workoutType: string
  durationMinutes: number
  intensity: WorkoutIntensity
  caloriesBurned: number
  confidence: number
  rationale: string
}
