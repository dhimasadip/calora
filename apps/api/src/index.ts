import './lib/timezone.js' // must be first: anchors process.env.TZ before any Date/DB use
import 'dotenv/config'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import authPlugin from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { onboardingRoutes } from './routes/onboarding.js'
import { logsRoutes } from './routes/logs.js'
import { agentRoutes } from './routes/agent.js'
import { promoRoutes } from './routes/promo.js'
import { loadEnv } from './lib/env.js'
import { client as dbClient } from './db/index.js'

const env = loadEnv()

const fastify = Fastify({
  logger: {
    level: env.isProd ? 'info' : 'debug',
    transport: env.isProd ? undefined : { target: 'pino-pretty' },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
  trustProxy: env.isProd,
  disableRequestLogging: false,
  bodyLimit: 1024 * 1024, // 1 MB
})

const start = async () => {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // SPA handles its own CSP via nginx
  })

  // Core plugins
  await fastify.register(cookie)
  await fastify.register(jwt, {
    secret: env.jwtSecret,
    cookie: { cookieName: 'access_token', signed: false },
  })
  await fastify.register(cors, {
    origin: env.appUrl,
    credentials: true,
  })
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await fastify.register(sensible)

  // Auth plugin (adds fastify.authenticate decorator)
  await fastify.register(authPlugin)

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' })
  await fastify.register(onboardingRoutes, { prefix: '/api/v1/profile' })
  await fastify.register(logsRoutes, { prefix: '/api/v1/logs' })
  await fastify.register(agentRoutes, { prefix: '/api/v1/agent' })
  await fastify.register(promoRoutes, { prefix: '/api/v1/promo' })

  // Health check
  fastify.get('/health', async () => ({ ok: true, uptime: process.uptime() }))

  await fastify.listen({ port: env.port, host: '0.0.0.0' })
}

const shutdown = async (signal: string) => {
  fastify.log.info({ signal }, 'received shutdown signal')
  try {
    await fastify.close()
    await dbClient.end({ timeout: 5 })
    process.exit(0)
  } catch (err) {
    fastify.log.error({ err }, 'shutdown failed')
    process.exit(1)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
