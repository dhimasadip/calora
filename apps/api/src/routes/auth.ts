import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import { DeleteAccountSchema, LoginSchema, RegisterSchema, ResendVerificationSchema, VerifyEmailSchema } from '@calora/shared'
import { db, emailVerificationTokens, refreshTokens, users } from '../db/index.js'
import { loadEnv } from '../lib/env.js'
import { sendVerificationEmail, smtpConfigured } from '../lib/mailer.js'
import { generateId, generateToken, hashToken } from '../lib/utils.js'

const env = loadEnv()
const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'
const ACCESS_COOKIE_MAX_AGE = 60 * 15
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24

function cookieOptions() {
  return { httpOnly: true, secure: env.isProd, sameSite: 'strict' as const }
}

function refreshExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  return expiry
}

function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, email: user.email, displayName: user.displayName, onboardingComplete: user.onboardingComplete, createdAt: user.createdAt }
}

async function issueSession(fastify: FastifyInstance, reply: FastifyReply, user: typeof users.$inferSelect) {
  const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_EXPIRY })
  const refreshToken = generateToken()
  await db.insert(refreshTokens).values({ id: generateId(), userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() })
  reply
    .setCookie('access_token', accessToken, { ...cookieOptions(), path: '/', maxAge: ACCESS_COOKIE_MAX_AGE })
    .setCookie('refresh_token', refreshToken, { ...cookieOptions(), path: '/api/v1/auth/refresh', maxAge: REFRESH_COOKIE_MAX_AGE })
}

// Creates a fresh single-use verification token for a user, revoking any
// previous ones. Returns the raw token (handed to the client once); only the
// SHA-256 hash is stored. Accepts either the global db or a transaction so the
// token row can join the registration transaction.
type DbExecutor = Pick<typeof db, 'insert' | 'delete'>
async function issueVerificationToken(userId: string, executor: DbExecutor = db): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  await executor.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId))
  await executor.insert(emailVerificationTokens).values({ id: generateId(), userId, tokenHash: hashToken(token), expiresAt })
  return token
}

function verificationLink(token: string): string {
  return `${env.appUrl}/verify-email?token=${token}`
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const credentialRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  fastify.post('/register', credentialRateLimit, async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const { email, password, displayName } = parsed.data
    const normalizedEmail = email.toLowerCase()
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1)
    if (existing) return reply.status(409).send({ error: 'Email already registered' })
    if (env.isProd && !smtpConfigured()) {
      const error = new Error('Email verification is not configured. Add SMTP_USER and SMTP_PASS to enable signups.')
      ;(error as Error & { statusCode?: number }).statusCode = 503
      throw error
    }

    // Create the account and its verification token inside one transaction, and
    // only commit once the email actually leaves our server. If the send fails,
    // the transaction rolls back so no unverifiable account is left behind.
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx.insert(users).values({
          id: generateId(), email: normalizedEmail, displayName, passwordHash: await bcrypt.hash(password, 12), emailVerified: false,
        }).returning()
        const token = await issueVerificationToken(created.id, tx)
        await sendVerificationEmail(created.email, verificationLink(token))
      })
    } catch (error) {
      console.error('Registration rolled back: verification email could not be sent', error)
      const statusCode = (error as Error & { statusCode?: number }).statusCode
      const underlying = error instanceof Error ? error.message : String(error)
      const failure = new Error(statusCode === 503
        ? 'Email verification is not configured. Add SMTP_USER and SMTP_PASS to enable signups.'
        : env.isProd ? 'Could not send the verification email. Please try again.' : `Could not send the verification email: ${underlying}`)
      ;(failure as Error & { statusCode?: number }).statusCode = statusCode === 503 ? 503 : 502
      throw failure
    }
    return reply.status(201).send({ message: 'Account created. Check your inbox for a verification link before signing in.' })
  })

  fastify.post('/login', credentialRateLimit, async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1)
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return reply.status(401).send({ error: 'Invalid email or password' })
    if (!user.emailVerified) return reply.status(403).send({ error: 'Please verify your email before signing in.', needsVerification: true })
    await issueSession(fastify, reply, user)
    return reply.send({ user: publicUser(user) })
  })

  fastify.post('/verify-email', credentialRateLimit, async (request, reply) => {
    const parsed = VerifyEmailSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const tokenHash = hashToken(parsed.data.token)
    const [record] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, tokenHash)).limit(1)
    if (!record || record.expiresAt <= new Date()) return reply.status(400).send({ error: 'This verification link is invalid or has expired. Request a new one from the sign-in page.' })
    const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1)
    if (!user) return reply.status(400).send({ error: 'This verification link is invalid or has expired. Request a new one from the sign-in page.' })
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id))
    if (!user.emailVerified) {
      await db.update(users).set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id))
    }
    const [verified] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
    await issueSession(fastify, reply, verified)
    return reply.send({ user: publicUser(verified) })
  })

  fastify.post('/resend-verification', credentialRateLimit, async (request, reply) => {
    const parsed = ResendVerificationSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1)
    if (user && !user.emailVerified) {
      if (env.isProd && !smtpConfigured()) {
        const error = new Error('Email verification is not configured. Add SMTP_USER and SMTP_PASS to enable signups.')
        ;(error as Error & { statusCode?: number }).statusCode = 503
        throw error
      }
      const token = await issueVerificationToken(user.id)
      try {
        await sendVerificationEmail(user.email, verificationLink(token))
      } catch (error) {
        console.error('Failed to send verification email', error)
      }
    }
    // Always the same response: never reveal whether an email is registered.
    return reply.send({ ok: true })
  })

  fastify.post('/refresh', async (request, reply) => {
    const rawToken = request.cookies.refresh_token
    if (!rawToken) return reply.status(401).send({ error: 'No refresh token' })
    const [stored] = await db.select().from(refreshTokens).where(and(eq(refreshTokens.tokenHash, hashToken(rawToken)), gt(refreshTokens.expiresAt, new Date()))).limit(1)
    if (!stored) return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1)
    if (!user) return reply.status(401).send({ error: 'User not found' })
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))
    await issueSession(fastify, reply, user)
    return reply.send({ user: publicUser(user) })
  })

  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const rawToken = request.cookies.refresh_token
    if (rawToken) await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
    reply.clearCookie('access_token', { path: '/' }).clearCookie('refresh_token', { path: '/api/v1/auth/refresh' })
    return reply.send({ ok: true })
  })

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ user: publicUser(user) })
  })

  fastify.delete('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const parsed = DeleteAccountSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1)
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return reply.status(401).send({ error: 'Password is incorrect' })
    await db.delete(users).where(eq(users.id, user.id))
    reply.clearCookie('access_token', { path: '/' }).clearCookie('refresh_token', { path: '/api/v1/auth/refresh' })
    return reply.send({ ok: true })
  })
}
