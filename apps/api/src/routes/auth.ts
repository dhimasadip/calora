import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { db, users, refreshTokens } from '../db/index.js'
import { eq, and, gt } from 'drizzle-orm'
import { RegisterSchema, LoginSchema } from '@calora/shared'
import { generateId, hashToken } from '../lib/utils.js'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'
const ACCESS_COOKIE_MAX_AGE = 60 * 15
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS

function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url')
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
      .returning({ id: users.id, email: users.email, displayName: users.displayName, onboardingComplete: users.onboardingComplete })

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

    return reply.status(201).send({ user })
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
