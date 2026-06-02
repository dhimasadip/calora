import { toDateStr } from './datetime.js'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active'
export type Goal = 'bulking' | 'cutting' | 'maintaining'
export type GoalIntensity = 'mild' | 'moderate' | 'aggressive'
export type Plan = 'free' | 'pro'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
}

const GOAL_ADJUSTMENTS: Record<Goal, Record<GoalIntensity, number>> = {
  maintaining: { mild: 0, moderate: 0, aggressive: 0 },
  cutting: { mild: -275, moderate: -550, aggressive: -1100 },
  bulking: { mild: 275, moderate: 550, aggressive: 1100 },
}

export function calculateBMR(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

export function calculateDailyTarget(tdee: number, goal: Goal, intensity: GoalIntensity): number {
  return Math.round(tdee + GOAL_ADJUSTMENTS[goal][intensity])
}

export interface MacroTargets {
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
}

// Standard macro split: 30% protein / 40% carbs / 30% fat of the calorie target.
// Protein & carbs at 4 kcal/g, fat at 9 kcal/g.
export function calculateMacroTargets(dailyCalorieTarget: number): MacroTargets {
  return {
    proteinTargetG: Math.round((dailyCalorieTarget * 0.3) / 4),
    carbsTargetG: Math.round((dailyCalorieTarget * 0.4) / 4),
    fatTargetG: Math.round((dailyCalorieTarget * 0.3) / 9),
  }
}

export function calculateAgeFromDOB(dateOfBirth: string): number {
  // Compare calendar days in Jakarta time so the birthday rollover is consistent
  // regardless of where the code runs.
  const [ty, tm, td] = toDateStr().split('-').map(Number)
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}

export function calculateWorkoutCalories(metValue: number, weightKg: number, durationMinutes: number): number {
  return Math.round(metValue * weightKg * (durationMinutes / 60))
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 10) / 10
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54
  return { feet: Math.floor(totalInches / 12), inches: Math.round(totalInches % 12) }
}

export function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54)
}
