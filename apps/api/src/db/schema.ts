import { boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const sexEnum = pgEnum('sex', ['male', 'female'])
export const activityLevelEnum = pgEnum('activity_level', ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'])
export const goalEnum = pgEnum('goal', ['bulking', 'cutting', 'maintaining'])
export const goalIntensityEnum = pgEnum('goal_intensity', ['mild', 'moderate', 'aggressive'])
export const targetModeEnum = pgEnum('daily_target_mode', ['auto', 'custom'])
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack', 'other'])
export const sourceEnum = pgEnum('entry_source', ['manual', 'ai'])
export const intensityEnum = pgEnum('workout_intensity', ['low', 'moderate', 'high'])
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant'])
export const unitPreferenceEnum = pgEnum('unit_preference', ['metric', 'imperial'])
export const estimateKindEnum = pgEnum('estimate_kind', ['food', 'exercise'])
export const aiUsageKindEnum = pgEnum('ai_usage_kind', ['food_estimate', 'exercise_estimate', 'coach'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dateOfBirth: text('date_of_birth').notNull(),
  sex: sexEnum('sex').notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  activityLevel: activityLevelEnum('activity_level').notNull(),
  goal: goalEnum('goal').notNull(),
  goalIntensity: goalIntensityEnum('goal_intensity').notNull(),
  targetWeightKg: real('target_weight_kg'),
  targetDate: date('target_date', { mode: 'string' }),
  bmr: integer('bmr').notNull(),
  tdee: integer('tdee').notNull(),
  suggestedDailyCalorieTarget: integer('suggested_daily_calorie_target').notNull(),
  dailyCalorieTarget: integer('daily_calorie_target').notNull(),
  dailyTargetMode: targetModeEnum('daily_target_mode').notNull().default('auto'),
  proteinTargetG: integer('protein_target_g').notNull(),
  carbsTargetG: integer('carbs_target_g').notNull(),
  fatTargetG: integer('fat_target_g').notNull(),
  unitPreference: unitPreferenceEnum('unit_preference').notNull().default('metric'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const foodEntries = pgTable('food_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
  loggedAt: timestamp('logged_at').notNull().defaultNow(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  calories: integer('calories').notNull(),
  proteinG: real('protein_g').notNull().default(0),
  carbsG: real('carbs_g').notNull().default(0),
  fatG: real('fat_g').notNull().default(0),
  mealType: mealTypeEnum('meal_type').notNull().default('other'),
  source: sourceEnum('source').notNull().default('manual'),
  rawInput: text('raw_input'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userDateIdx: index('food_entries_user_date_idx').on(table.userId, table.date),
  userUpdatedIdx: index('food_entries_user_updated_idx').on(table.userId, table.updatedAt),
}))

export const exerciseEntries = pgTable('exercise_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
  loggedAt: timestamp('logged_at').notNull().defaultNow(),
  name: text('name').notNull(),
  workoutType: text('workout_type').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  intensity: intensityEnum('intensity').notNull().default('moderate'),
  caloriesBurned: integer('calories_burned').notNull(),
  notes: text('notes'),
  source: sourceEnum('source').notNull().default('manual'),
  rawInput: text('raw_input'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userDateIdx: index('exercise_entries_user_date_idx').on(table.userId, table.date),
  userUpdatedIdx: index('exercise_entries_user_updated_idx').on(table.userId, table.updatedAt),
}))

export const weightLogs = pgTable('weight_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  weightKg: real('weight_kg').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userDateUnique: uniqueIndex('weight_logs_user_date_unique').on(table.userId, table.date),
  userDateIdx: index('weight_logs_user_date_idx').on(table.userId, table.date),
}))

export const agentMessages = pgTable('agent_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userSessionIdx: index('agent_messages_user_session_idx').on(table.userId, table.sessionId, table.createdAt),
}))

export const aiEstimateCache = pgTable('ai_estimate_cache', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: estimateKindEnum('kind').notNull(),
  inputHash: text('input_hash').notNull(),
  response: jsonb('response').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  cacheKey: uniqueIndex('ai_estimate_cache_user_kind_hash_unique').on(table.userId, table.kind, table.inputHash),
  expiryIdx: index('ai_estimate_cache_expiry_idx').on(table.expiresAt),
}))

export const aiUsageDaily = pgTable('ai_usage_daily', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  invocationCount: integer('invocation_count').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  usageKey: uniqueIndex('ai_usage_daily_user_date_unique').on(table.userId, table.date),
}))

export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: aiUsageKindEnum('kind').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  promptCacheHitTokens: integer('prompt_cache_hit_tokens').notNull().default(0),
  promptCacheMissTokens: integer('prompt_cache_miss_tokens').notNull().default(0),
  costUsd: doublePrecision('cost_usd').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx: index('ai_usage_logs_user_created_idx').on(table.userId, table.createdAt),
}))

export const reminderPreferences = pgTable('reminder_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mealReminderEnabled: boolean('meal_reminder_enabled').notNull().default(false),
  mealReminderTime: text('meal_reminder_time').notNull().default('12:00'),
  weightReminderEnabled: boolean('weight_reminder_enabled').notNull().default(false),
  weightReminderTime: text('weight_reminder_time').notNull().default('08:00'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  response: jsonb('response').notNull(),
  statusCode: integer('status_code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userKey: uniqueIndex('idempotency_keys_user_key_unique').on(table.userId, table.key),
  expiryIdx: index('idempotency_keys_expiry_idx').on(table.expiresAt),
}))

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.userId),
  expiryIdx: index('refresh_tokens_expiry_idx').on(table.expiresAt),
}))
