const REQUIRED_IN_PROD = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'ANTHROPIC_API_KEY'] as const

export function loadEnv() {
  const isProd = process.env.NODE_ENV === 'production'
  const missing: string[] = []

  for (const key of REQUIRED_IN_PROD) {
    if (!process.env[key]) missing.push(key)
  }

  if (isProd && missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`)
  }

  if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production')
  }

  return {
    isProd,
    port: parseInt(process.env.PORT ?? '3001', 10),
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-not-for-production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    // Gmail SMTP: nodemailer's `service: 'gmail'` supplies host/port, so we only need
    // the account + an App Password (regular Gmail passwords don't work over SMTP).
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPass: process.env.SMTP_PASS ?? '',
    smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@calora.local',
  }
}

export type Env = ReturnType<typeof loadEnv>
