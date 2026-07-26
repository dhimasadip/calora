const REQUIRED_IN_PROD = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'OPENAI_API_KEY'] as const

export function loadEnv() {
  const isProd = process.env.NODE_ENV === 'production'
  const missing = REQUIRED_IN_PROD.filter((key) => !process.env[key])
  if (isProd && missing.length) throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`)
  if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production')

  return {
    isProd,
    port: Number.parseInt(process.env.PORT ?? '3001', 10),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-not-for-production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5.6-terra',
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? '',
    aiDailyLimit: Number.parseInt(process.env.AI_DAILY_LIMIT ?? '10', 10),
    aiCacheTtlHours: Number.parseInt(process.env.AI_CACHE_TTL_HOURS ?? '24', 10),
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    privacyContactEmail: process.env.PRIVACY_CONTACT_EMAIL ?? 'privacy@calora.local',
  }
}

export type Env = ReturnType<typeof loadEnv>
