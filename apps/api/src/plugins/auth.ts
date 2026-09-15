import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { db, users } from '../db/index.js'
import { eq } from 'drizzle-orm'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userEmail: string
    isAdmin?: boolean
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      const payload = request.user as { sub: string; email: string }
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
      if (!user) {
        return reply.status(401).send({ error: 'User not found' })
      }
      request.userId = user.id
      request.userEmail = user.email
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.decorate('authenticateAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      const payload = request.user as { sub: string; admin?: boolean }
      if (payload.sub !== 'admin' || payload.admin !== true) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
      request.isAdmin = true
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(authPlugin)
