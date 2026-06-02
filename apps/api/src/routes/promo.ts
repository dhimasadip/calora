import type { FastifyPluginAsync } from 'fastify'
import { db, users, promoCodes, promoRedemptions } from '../db/index.js'
import { and, eq, sql } from 'drizzle-orm'
import { RedeemPromoCodeSchema, type RedeemPromoResponse } from '@calora/shared'
import { generateId } from '../lib/utils.js'
import { planExpiresAtStrSql } from '../lib/plan.js'

export const promoRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/promo/redeem — redeem a promo code to activate (or extend) Pro.
  fastify.post('/redeem', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = RedeemPromoCodeSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    }
    const code = result.data.code.trim().toUpperCase()

    const outcome = await db.transaction(async (tx) => {
      // Lock the promo row so concurrent redemptions can't oversell the stock.
      const [promo] = await tx
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, code))
        .for('update')
        .limit(1)
      if (!promo) return { error: 'not_found' as const }
      if (promo.stock <= 0) return { error: 'out_of_stock' as const }

      const [existing] = await tx
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(and(eq(promoRedemptions.userId, request.userId), eq(promoRedemptions.code, code)))
        .limit(1)
      if (existing) return { error: 'already_redeemed' as const }

      // Extend from the later of now / current expiry, so stacking codes adds time.
      const [updated] = await tx
        .update(users)
        .set({
          plan: 'pro',
          planExpiresAt: sql`greatest(now(), coalesce(${users.planExpiresAt}, now())) + make_interval(days => ${promo.durationDays})`,
        })
        .where(eq(users.id, request.userId))
        .returning({ planExpiresAt: planExpiresAtStrSql })

      await tx
        .update(promoCodes)
        .set({ stock: sql`${promoCodes.stock} - 1` })
        .where(eq(promoCodes.code, code))

      await tx.insert(promoRedemptions).values({ id: generateId(), userId: request.userId, code })

      return { ok: true as const, planExpiresAt: updated.planExpiresAt }
    })

    if ('error' in outcome) {
      if (outcome.error === 'not_found') return reply.status(404).send({ error: 'Invalid promo code' })
      if (outcome.error === 'out_of_stock') return reply.status(409).send({ error: 'This promo code is no longer available' })
      return reply.status(409).send({ error: 'You already redeemed this code' })
    }

    return reply.send({ plan: 'pro', planExpiresAt: outcome.planExpiresAt } satisfies RedeemPromoResponse)
  })
}
