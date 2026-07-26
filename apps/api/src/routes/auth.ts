import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import { DeleteAccountSchema, LoginSchema, RegisterSchema } from '@calora/shared'
import { db, refreshTokens, users } from '../db/index.js'
import { loadEnv } from '../lib/env.js'
import { generateId, generateToken, hashToken } from '../lib/utils.js'

const env = loadEnv()
const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'
const ACCESS_COOKIE_MAX_AGE = 60 * 15
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS

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

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const credentialRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  fastify.post('/register', credentialRateLimit, async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const { email, password, displayName } = parsed.data
    const normalizedEmail = email.toLowerCase()
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1)
    if (existing) return reply.status(409).send({ error: 'Email already registered' })

    const [user] = await db.insert(users).values({
      id: generateId(), email: normalizedEmail, displayName, passwordHash: await bcrypt.hash(password, 12),
    }).returning()
    await issueSession(fastify, reply, user)
    return reply.status(201).send({ user: publicUser(user) })
  })

  fastify.post('/login', credentialRateLimit, async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten().fieldErrors })
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1)
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return reply.status(401).send({ error: 'Invalid email or password' })
    await issueSession(fastify, reply, user)
    return reply.send({ user: publicUser(user) })
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
