import { z } from 'zod'

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[a-z]/, 'Password must include a lowercase letter').regex(/[A-Z]/, 'Password must include an uppercase letter').regex(/[0-9]/, 'Password must include a number'),
  displayName: z.string().trim().min(1).max(64),
})

export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
export const DeleteAccountSchema = z.object({ password: z.string().min(1) })

const ProfileFields = z.object({
  dateOfBirth: DateSchema,
  sex: z.enum(['male', 'female']),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']),
  goal: z.enum(['bulking', 'cutting', 'maintaining']),
  goalIntensity: z.enum(['mild', 'moderate', 'aggressive']),
  targetWeightKg: z.number().min(20).max(500).nullable().optional(),
  targetDate: DateSchema.nullable().optional(),
  dailyCalorieTarget: z.number().int().min(800).max(10000).optional(),
  dailyTargetMode: z.enum(['auto', 'custom']).default('auto'),
  unitPreference: z.enum(['metric', 'imperial']).default('metric'),
})

export const CreateUserProfileSchema = ProfileFields
export const UpdateUserProfileSchema = ProfileFields.partial()

const FoodFields = z.object({
  name: z.string().trim().min(1).max(255),
  quantity: z.number().positive().max(100000),
  unit: z.string().trim().min(1).max(50),
  calories: z.number().int().min(0).max(20000),
  proteinG: z.number().min(0).max(5000).optional(),
  carbsG: z.number().min(0).max(5000).optional(),
  fatG: z.number().min(0).max(5000).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']).default('other'),
  date: DateSchema.optional(),
  loggedAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'ai']).default('manual'),
  rawInput: z.string().max(2000).nullable().optional(),
})

export const CreateFoodEntrySchema = FoodFields
export const UpdateFoodEntrySchema = FoodFields.omit({ source: true, rawInput: true }).partial().extend({ expectedVersion: z.number().int().positive() })

const ExerciseFields = z.object({
  name: z.string().trim().min(1).max(255),
  workoutType: z.string().trim().min(1).max(100),
  durationMinutes: z.number().int().positive().max(1440),
  intensity: z.enum(['low', 'moderate', 'high']).default('moderate'),
  caloriesBurned: z.number().int().min(0).max(20000),
  notes: z.string().trim().max(2000).nullable().optional(),
  date: DateSchema.optional(),
  loggedAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'ai']).default('manual'),
  rawInput: z.string().max(2000).nullable().optional(),
})

export const CreateExerciseEntrySchema = ExerciseFields
export const UpdateExerciseEntrySchema = ExerciseFields.omit({ source: true, rawInput: true }).partial().extend({ expectedVersion: z.number().int().positive() })

export const FoodEstimateRequestSchema = z.object({
  description: z.string().trim().min(2).max(2000),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']).optional(),
})

export const ExerciseEstimateRequestSchema = z.object({
  description: z.string().trim().min(2).max(2000),
})

export const FoodEstimateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  quantity: z.number().positive().max(100000),
  unit: z.string().trim().min(1).max(50),
  calories: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(500),
})

export const ExerciseEstimateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  workoutType: z.string().trim().min(1).max(100),
  durationMinutes: z.number().int().positive().max(1440),
  intensity: z.enum(['low', 'moderate', 'high']),
  caloriesBurned: z.number().int().min(0).max(5000),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(500),
})

export const CoachMessageSchema = z.object({ content: z.string().trim().min(1).max(4000), sessionId: z.string().min(1).max(100) })

export const WeightLogSchema = z.object({
  date: DateSchema,
  weightKg: z.number().min(20).max(500),
  expectedVersion: z.number().int().positive().optional(),
})

export const ReminderPreferencesSchema = z.object({
  mealReminderEnabled: z.boolean().default(false),
  mealReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('12:00'),
  weightReminderEnabled: z.boolean().default(false),
  weightReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('08:00'),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type CreateUserProfileInput = z.infer<typeof CreateUserProfileSchema>
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>
export type CreateFoodEntryInput = z.infer<typeof CreateFoodEntrySchema>
export type UpdateFoodEntryInput = z.infer<typeof UpdateFoodEntrySchema>
export type CreateExerciseEntryInput = z.infer<typeof CreateExerciseEntrySchema>
export type UpdateExerciseEntryInput = z.infer<typeof UpdateExerciseEntrySchema>
export type FoodEstimateInput = z.infer<typeof FoodEstimateSchema>
export type ExerciseEstimateInput = z.infer<typeof ExerciseEstimateSchema>
