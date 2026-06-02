import { pgTable, text, integer, real, boolean, timestamp, date, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const sexEnum = pgEnum('sex', ['male', 'female'])
export const activityLevelEnum = pgEnum('activity_level', [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
])
export const goalEnum = pgEnum('goal', ['bulking', 'cutting', 'maintaining'])
export const goalIntensityEnum = pgEnum('goal_intensity', ['mild', 'moderate', 'aggressive'])
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack', 'other'])
export const logSourceEnum = pgEnum('log_source', ['agent', 'manual'])
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant'])
export const unitPrefEnum = pgEnum('unit_preference', ['metric', 'imperial'])
export const planEnum = pgEnum('plan', ['free', 'pro'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  plan: planEnum('plan').notNull().default('free'),
  // Jakarta wall-clock instant the Pro plan expires (null = no active Pro / never expires).
  // Always set & compared via SQL now() so it stays in the Jakarta-pinned session timezone.
  planExpiresAt: timestamp('plan_expires_at'),
  // Anchor of the current Pro chat-limit window. The 6h countdown starts at the first chat
  // of a window; once it elapses the next chat opens a fresh window. Null = no window started.
  proWindowStartedAt: timestamp('pro_window_started_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateOfBirth: text('date_of_birth').notNull(),
  sex: sexEnum('sex').notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  activityLevel: activityLevelEnum('activity_level').notNull(),
  goal: goalEnum('goal').notNull(),
  goalIntensity: goalIntensityEnum('goal_intensity').notNull(),
  targetWeightKg: real('target_weight_kg'),
  bmr: integer('bmr').notNull(),
  tdee: integer('tdee').notNull(),
  dailyCalorieTarget: integer('daily_calorie_target').notNull(),
  proteinTargetG: integer('protein_target_g').notNull().default(0),
  carbsTargetG: integer('carbs_target_g').notNull().default(0),
  fatTargetG: integer('fat_target_g').notNull().default(0),
  unitPreference: unitPrefEnum('unit_preference').notNull().default('metric'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const foodLogs = pgTable(
  'food_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: timestamp('logged_at').notNull().defaultNow(),
    date: date('date', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
    description: text('description').notNull(),
    calories: integer('calories').notNull(),
    proteinG: real('protein_g').notNull().default(0),
    carbsG: real('carbs_g').notNull().default(0),
    fatG: real('fat_g').notNull().default(0),
    mealType: mealTypeEnum('meal_type').notNull().default('other'),
    source: logSourceEnum('source').notNull().default('manual'),
    rawInput: text('raw_input'),
  },
  (table) => ({
    userLoggedAtIdx: index('food_logs_user_logged_at_idx').on(table.userId, table.loggedAt),
    userDateIdx: index('food_logs_user_date_idx').on(table.userId, table.date),
  }),
)

export const workoutLogs = pgTable(
  'workout_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: timestamp('logged_at').notNull().defaultNow(),
    date: date('date', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
    description: text('description').notNull(),
    workoutType: text('workout_type').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    caloriesBurned: integer('calories_burned').notNull(),
    source: logSourceEnum('source').notNull().default('manual'),
    rawInput: text('raw_input'),
  },
  (table) => ({
    userLoggedAtIdx: index('workout_logs_user_logged_at_idx').on(table.userId, table.loggedAt),
    userDateIdx: index('workout_logs_user_date_idx').on(table.userId, table.date),
  }),
)

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userSessionCreatedIdx: index('agent_messages_user_session_created_idx').on(
      table.userId,
      table.sessionId,
      table.createdAt,
    ),
    // Supports the per-user chat-limit window count (by user + time, across sessions).
    userCreatedIdx: index('agent_messages_user_created_idx').on(table.userId, table.createdAt),
  }),
)

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
  }),
)

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('email_verification_tokens_user_id_idx').on(table.userId),
    expiresAtIdx: index('email_verification_tokens_expires_at_idx').on(table.expiresAt),
  }),
)

// Promo codes unlock the Pro plan. Created manually in the DB (no admin UI yet).
// `code` is the normalized (uppercased) primary key; `stock` is remaining redemptions;
// `durationDays` is how long Pro lasts when this code is redeemed (extends on re-redeem).
export const promoCodes = pgTable('promo_codes', {
  code: text('code').primaryKey(),
  stock: integer('stock').notNull().default(0),
  durationDays: integer('duration_days').notNull().default(30),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One row per (user, code) redemption — audit trail + prevents a user reusing the same code.
export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code')
      .notNull()
      .references(() => promoCodes.code),
    redeemedAt: timestamp('redeemed_at').notNull().defaultNow(),
  },
  (table) => ({
    userCodeIdx: uniqueIndex('promo_redemptions_user_code_idx').on(table.userId, table.code),
    userIdx: index('promo_redemptions_user_id_idx').on(table.userId),
  }),
)
