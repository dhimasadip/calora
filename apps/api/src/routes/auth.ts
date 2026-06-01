import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { db, users, refreshTokens, emailVerificationTokens } from '../db/index.js'
import { eq, and, gt } from 'drizzle-orm'
import { RegisterSchema, LoginSchema, VerifyEmailSchema, ResendVerificationSchema } from '@calora/shared'
import { generateId, generateToken, hashToken } from '../lib/utils.js'
import { loadEnv } from '../lib/env.js'
import { sendVerificationEmail } from '../lib/email.js'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'
const ACCESS_COOKIE_MAX_AGE = 60 * 15
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24

const env = loadEnv()

function generateRefreshToken(): string {
  return generateToken()
}

function cookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
  }
}

function issueRefreshExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  return d
}

function issueVerificationExpiry(): Date {
  const d = new Date()
  d.setHours(d.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS)
  return d
}

// Issue a fresh single-use verification token (replacing any prior one) and email the link.
async function sendVerification(userId: string, email: string, displayName: string): Promise<void> {
  const rawToken = generateToken()
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId))
  await db.insert(emailVerificationTokens).values({
    id: generateId(),
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: issueVerificationExpiry(),
  })
  const verifyUrl = `${env.appUrl}/verify-email?token=${rawToken}`
  await sendVerificationEmail({ to: email, displayName, verifyUrl })
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const isProd = process.env.NODE_ENV === 'production'

  // Stricter rate-limit for credential-handling endpoints
  const credentialRateLimit = {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }

  // POST /api/v1/auth/register
  fastify.post('/register', credentialRateLimit, async (request, reply) => {
    const result = RegisterSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }
    const { email, password, displayName } = result.data
    const emailLower = email.toLowerCase()

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, emailLower)).limit(1)
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = generateId()

    const [user] = await db
      .insert(users)
      .values({ id: userId, email: emailLower, passwordHash, displayName })
      .returning({ id: users.id, email: users.email, displayName: users.displayName })

    // No auth cookies are issued: the account stays unverified and cannot log in until the
    // user confirms their email via the link below.
    await sendVerification(user.id, user.email, user.displayName)

    return reply.status(201).send({
      message: 'Verification email sent. Please check your inbox to activate your account.',
      email: user.email,
    })
  })

  // POST /api/v1/auth/login
  fastify.post('/login', credentialRateLimit, async (request, reply) => {
    const result = LoginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }
    const { email, password } = result.data

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    if (!user.emailVerified) {
      return reply.status(403).send({
        error: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_EXPIRY })
    const refreshToken = generateRefreshToken()

    await db.insert(refreshTokens).values({
      id: generateId(),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: issueRefreshExpiry(),
    })

    reply
      .setCookie('access_token', accessToken, {
        ...cookieOptions(isProd),
        path: '/',
        maxAge: ACCESS_COOKIE_MAX_AGE,
      })
      .setCookie('refresh_token', refreshToken, {
        ...cookieOptions(isProd),
        path: '/api/v1/auth/refresh',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      })

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        onboardingComplete: user.onboardingComplete,
      },
    })
  })

  // POST /api/v1/auth/verify-email
  fastify.post('/verify-email', credentialRateLimit, async (request, reply) => {
    const result = VerifyEmailSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }

    const tokenHash = hashToken(result.data.token)
    const now = new Date()

    const [stored] = await db
      .select()
      .from(emailVerificationTokens)
      .where(and(eq(emailVerificationTokens.tokenHash, tokenHash), gt(emailVerificationTokens.expiresAt, now)))
      .limit(1)

    if (!stored) {
      return reply.status(400).send({ error: 'Invalid or expired verification link' })
    }

    // Mark verified and consume the token (single use) in parallel.
    await Promise.all([
      db.update(users).set({ emailVerified: true }).where(eq(users.id, stored.userId)),
      db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, stored.id)),
    ])

    return reply.send({ ok: true })
  })

  // POST /api/v1/auth/resend-verification
  fastify.post('/resend-verification', credentialRateLimit, async (request, reply) => {
    const result = ResendVerificationSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, result.data.email.toLowerCase()))
      .limit(1)

    // Only re-send for an existing, still-unverified account. Always return the same
    // response so the endpoint can't be used to probe which emails are registered.
    if (user && !user.emailVerified) {
      await sendVerification(user.id, user.email, user.displayName)
    }

    return reply.send({ ok: true })
  })

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const token = request.cookies['refresh_token']
    if (!token) return reply.status(401).send({ error: 'No refresh token' })

    const tokenHash = hashToken(token)
    const now = new Date()

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, now)))
      .limit(1)

    if (!stored) return reply.status(401).send({ error: 'Invalid or expired refresh token' })

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1)
    if (!user) return reply.status(401).send({ error: 'User not found' })

    const newRefreshToken = generateRefreshToken()

    // Rotate: delete old + insert new in parallel
    await Promise.all([
      db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id)),
      db.insert(refreshTokens).values({
        id: generateId(),
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: issueRefreshExpiry(),
      }),
    ])

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_EXPIRY })

    reply
      .setCookie('access_token', accessToken, {
        ...cookieOptions(isProd),
        path: '/',
        maxAge: ACCESS_COOKIE_MAX_AGE,
      })
      .setCookie('refresh_token', newRefreshToken, {
        ...cookieOptions(isProd),
        path: '/api/v1/auth/refresh',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      })

    return reply.send({ ok: true })
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const token = request.cookies['refresh_token']
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(token)))
    }

    reply
      .clearCookie('access_token', { path: '/' })
      .clearCookie('refresh_token', { path: '/api/v1/auth/refresh' })

    return reply.send({ ok: true })
  })

  // GET /api/v1/auth/me
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName, onboardingComplete: users.onboardingComplete })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1)

    if (!user) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ user })
  })
}
