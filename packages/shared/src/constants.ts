export const MET_VALUES: Record<string, number> = {
  running: 9.8,
  cycling: 7.5,
  walking: 3.5,
  swimming: 7.0,
  weightlifting: 4.5,
  yoga: 2.5,
  hiit: 8.0,
  elliptical: 5.0,
  rowing: 7.0,
  jump_rope: 11.0,
  basketball: 6.5,
  soccer: 7.0,
  tennis: 7.3,
  dancing: 5.0,
  pilates: 3.0,
}

export const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
  sedentary: 'Sedentary (desk job, little/no exercise)',
  lightly_active: 'Lightly Active (1–3 days/week)',
  moderately_active: 'Moderately Active (3–5 days/week)',
  very_active: 'Very Active (6–7 days/week)',
  extremely_active: 'Extremely Active (physical job or twice-daily training)',
}

export const GOAL_LABELS: Record<string, string> = {
  bulking: 'Bulking — Build muscle (calorie surplus)',
  cutting: 'Cutting — Lose body fat (calorie deficit)',
  maintaining: 'Maintaining — Stay at current weight',
}

export const INTENSITY_LABELS: Record<string, string> = {
  mild: 'Mild (±0.25 kg/week)',
  moderate: 'Moderate (±0.5 kg/week) — Recommended',
  aggressive: 'Aggressive (±1 kg/week)',
}
