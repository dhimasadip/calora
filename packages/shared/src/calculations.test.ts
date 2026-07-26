import { describe, expect, it } from 'vitest'
import { calculateBMR, calculateDailyTarget, calculateMacroTargets, calculateTDEE, calculateWorkoutCalories, ftInToCm, kgToLbs, lbsToKg } from './calculations.js'

describe('Calora calculations', () => {
  it('calculates Mifflin-St Jeor targets and macro targets deterministically', () => {
    const bmr = calculateBMR(70, 175, 30, 'male')
    expect(bmr).toBeCloseTo(1648.75)
    const tdee = calculateTDEE(bmr, 'moderately_active')
    expect(tdee).toBe(2556)
    expect(calculateDailyTarget(tdee, 'cutting', 'moderate')).toBe(2006)
    expect(calculateMacroTargets(2000)).toEqual({ proteinTargetG: 150, carbsTargetG: 200, fatTargetG: 67 })
  })

  it('keeps common conversion and MET calculations stable', () => {
    expect(lbsToKg(kgToLbs(70))).toBe(70)
    expect(ftInToCm(5, 7)).toBe(170)
    expect(calculateWorkoutCalories(9.8, 70, 30)).toBe(343)
  })
})
