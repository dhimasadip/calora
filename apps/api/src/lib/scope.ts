export const SCOPE_CLASSIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['inScope'],
  properties: { inScope: { type: 'boolean' } },
}

export const SCOPE_REFUSAL = "I'm Calora's nutrition and workout coach, so I only help with food, calories, macros, hydration, workouts, and weight goals. Try asking me to estimate a meal, plan a snack, or check how today is going against your target."

export function parseScopeResponse(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { inScope?: unknown } | null
    return parsed?.inScope === true
  } catch {
    return false
  }
}

export function scopeRefusalMessage(kind: 'food' | 'exercise'): string {
  return kind === 'food'
    ? "That doesn't look like a food or meal. Describe what you ate or drank (e.g. 'chicken salad sandwich') and Calora will estimate it."
    : "That doesn't look like a workout. Describe the exercise (e.g. '30 minute jog') and Calora will estimate the calories burned."
}
