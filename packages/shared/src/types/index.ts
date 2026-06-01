import type { ActivityLevel, Goal, GoalIntensity, Sex } from '../calculations.js'

export type { ActivityLevel, Goal, GoalIntensity, Sex }

export interface User {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
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
  bmr: number
  tdee: number
  dailyCalorieTarget: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  unitPreference: 'metric' | 'imperial'
  updatedAt: string
}

export interface FoodLog {
  id: string
  userId: string
  loggedAt: string
  date: string
  description: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'
  source: 'agent' | 'manual'
  rawInput: string | null
}

export interface WorkoutLog {
  id: string
  userId: string
  loggedAt: string
  date: string
  description: string
  workoutType: string
  durationMinutes: number
  caloriesBurned: number
  source: 'agent' | 'manual'
  rawInput: string | null
}

export interface AgentMessage {
  id: string
  userId: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface DailySummary {
  date: string
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  dailyTarget: number
  remaining: number
  proteinG: number
  carbsG: number
  fatG: number
  foodLogs: FoodLog[]
  workoutLogs: WorkoutLog[]
}

export interface WeeklySummary {
  days: Array<{
    date: string
    caloriesIn: number
    caloriesBurned: number
    netCalories: number
    target: number
  }>
}

export interface RangeDay {
  date: string
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  target: number
}

export interface RangeSummary {
  from: string
  to: string
  days: number
  caloriesIn: number
  caloriesBurned: number
  netCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  netTarget: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  daily: RangeDay[]
  foodLogs: FoodLog[]
  workoutLogs: WorkoutLog[]
}
