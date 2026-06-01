import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must include a letter')
    .regex(/[0-9]/, 'Password must include a number'),
  displayName: z.string().min(1).max(64),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const CreateUserProfileSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['male', 'female']),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']),
  goal: z.enum(['bulking', 'cutting', 'maintaining']),
  goalIntensity: z.enum(['mild', 'moderate', 'aggressive']),
  targetWeightKg: z.number().min(20).max(500).nullable().optional(),
  unitPreference: z.enum(['metric', 'imperial']).default('metric'),
})

export const UpdateUserProfileSchema = CreateUserProfileSchema.partial()

export const CreateFoodLogSchema = z.object({
  description: z.string().min(1),
  calories: z.number().min(0),
  proteinG: z.number().min(0).default(0),
  carbsG: z.number().min(0).default(0),
  fatG: z.number().min(0).default(0),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']).default('other'),
  loggedAt: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['agent', 'manual']).default('manual'),
  rawInput: z.string().nullable().optional(),
})

export const UpdateFoodLogSchema = CreateFoodLogSchema.partial()

export const CreateWorkoutLogSchema = z.object({
  description: z.string().min(1),
  workoutType: z.string().min(1),
  durationMinutes: z.number().min(1),
  caloriesBurned: z.number().min(0),
  loggedAt: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['agent', 'manual']).default('manual'),
  rawInput: z.string().nullable().optional(),
})

export const UpdateWorkoutLogSchema = CreateWorkoutLogSchema.partial()

export const AgentMessageSchema = z.object({
  content: z.string().min(1),
  sessionId: z.string().min(1),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type CreateUserProfileInput = z.infer<typeof CreateUserProfileSchema>
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>
export type CreateFoodLogInput = z.infer<typeof CreateFoodLogSchema>
export type UpdateFoodLogInput = z.infer<typeof UpdateFoodLogSchema>
export type CreateWorkoutLogInput = z.infer<typeof CreateWorkoutLogSchema>
export type AgentMessageInput = z.infer<typeof AgentMessageSchema>
