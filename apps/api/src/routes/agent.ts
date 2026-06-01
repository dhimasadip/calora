import type { FastifyPluginAsync } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { db, users, userProfiles, foodLogs, workoutLogs, agentMessages } from '../db/index.js'
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm'
import { AgentMessageSchema, formatInJakarta } from '@calora/shared'
import { generateId, toDateStr, shiftDateStr, resolveEntryDate } from '../lib/utils.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })

async function buildSystemPrompt(userId: string): Promise<string> {
  const today = new Date()
  const todayStr = toDateStr(today)

  const [userRows, profileRows, food, workouts] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
    db.select().from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, todayStr)))
      .orderBy(foodLogs.loggedAt),
    db.select().from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.date, todayStr)))
      .orderBy(workoutLogs.loggedAt),
  ])

  const user = userRows[0]
  const profile = profileRows[0]
  const caloriesIn = food.reduce((s, f) => s + f.calories, 0)
  const caloriesBurned = workouts.reduce((s, w) => s + w.caloriesBurned, 0)
  const netCalories = caloriesIn - caloriesBurned
  const target = profile?.dailyCalorieTarget ?? 2000
  const remaining = target - netCalories

  const foodList = food.length
    ? food.map(f => `  - [id: ${f.id}] ${f.description}: ${f.calories} kcal (P:${f.proteinG}g C:${f.carbsG}g F:${f.fatG}g) [${f.mealType}]`).join('\n')
    : '  (none yet)'
  const workoutList = workouts.length
    ? workouts.map(w => `  - [id: ${w.id}] ${w.description}: ${w.caloriesBurned} kcal burned`).join('\n')
    : '  (none yet)'

  return `You are Calora, an AI nutrition and fitness assistant embedded in a calorie tracking app. You help users log food and workouts through natural conversation and answer questions about their progress.

## User
Name: ${user?.displayName ?? 'User'}
${profile ? `Goal: ${profile.goal} (${profile.goalIntensity} intensity)
Current weight: ${profile.weightKg} kg
Daily calorie target: ${target} kcal/day
BMR: ${profile.bmr} kcal | TDEE: ${profile.tdee} kcal` : 'Profile not set up yet.'}

## Today (${formatInJakarta(today, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
Current date: ${todayStr} (Jakarta time / WIB; use this to resolve relative days like "yesterday" / "kemarin")
Calories consumed: ${caloriesIn} kcal
Calories burned (workouts): ${caloriesBurned} kcal
Net calories: ${netCalories} kcal / ${target} kcal target
Remaining: ${remaining > 0 ? remaining : 0} kcal ${remaining < 0 ? `(${Math.abs(remaining)} kcal OVER target)` : ''}

## Today's Food Log
${foodList}

## Today's Workout Log
${workoutList}

## Guidelines
- Parse natural language food and workout descriptions
- CRITICAL: the ONLY way to record anything is to call a tool (save_food_log / save_workout_log / update_food_log / update_workout_log / delete_food_log / delete_workout_log). Writing "logged it" / "sudah dicatat" in your reply text does NOT save anything to the database.
- Whenever the user mentions eating food or doing a workout, immediately estimate the values and call the matching save tool in the SAME turn — do not ask for confirmation first, just save it.
- If a single message mentions MULTIPLE distinct items, log EACH item as its own separate entry: call the save tool once per item (multiple tool calls in the same turn) so they become separate rows. Do NOT merge several foods/workouts into one combined entry. Example: "tadi makan nasi goreng, telur, dan jus jeruk" → three separate save_food_log calls (nasi goreng / telur / jus jeruk), each with its own calories and macros.
- NEVER tell the user you logged, updated, or deleted an entry unless you actually called the corresponding tool this turn. Only confirm what you really saved.
- Back-dating: if the user refers to a previous day (e.g. "kemarin malam saya makan nasi goreng" / "last night", "2 days ago", a specific date), pass the matching \`date\` (YYYY-MM-DD) to the save tool, computed relative to the current date above, so the entry is recorded on that day. Omit \`date\` for things eaten/done today.
- Estimate calories/macros for food based on common nutritional data
- Estimate workout calories using MET × body weight × duration
- Only ask a clarifying question if you genuinely cannot produce any reasonable estimate; otherwise make your best estimate and save it immediately (the user can correct it afterwards and you will update it)
- When the user corrects or revises an entry already logged today (e.g. "actually it was 1 egg, not 2", "the run was 20 min not 30"), UPDATE the matching existing entry using update_food_log / update_workout_log with its [id] from the logs above — do NOT create a duplicate new entry
- When the user wants to remove an entry entirely (e.g. "scratch that", "I didn't eat the toast"), use delete_food_log / delete_workout_log with the matching [id]
- Match the entry to revise by its description/meal in the logs above; if multiple entries could match and it's unclear which, ask ONE clarifying question before updating or deleting
- Never give medical or clinical diet advice
- Always caveat that estimates for homemade/unlabeled food are approximations
- If you can't identify a food item, say so and suggest alternatives
- Be encouraging, concise, and data-driven`
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_food_log',
    description: 'Save a food entry to the user\'s log after estimating calories and macros.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Human-readable food description' },
        calories: { type: 'number', description: 'Estimated total calories (kcal)' },
        proteinG: { type: 'number', description: 'Estimated protein in grams' },
        carbsG: { type: 'number', description: 'Estimated carbohydrates in grams' },
        fatG: { type: 'number', description: 'Estimated fat in grams' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] },
        date: { type: 'string', description: 'Calendar day this meal belongs to as YYYY-MM-DD. Set it when the user refers to a previous day (e.g. "kemarin"/"yesterday"); omit for today.' },
      },
      required: ['description', 'calories', 'proteinG', 'carbsG', 'fatG', 'mealType'],
    },
  },
  {
    name: 'save_workout_log',
    description: 'Save a workout entry to the user\'s log after estimating calories burned.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Human-readable workout description' },
        workoutType: { type: 'string', description: 'Type of workout (e.g. running, cycling, weightlifting)' },
        durationMinutes: { type: 'number', description: 'Duration in minutes' },
        caloriesBurned: { type: 'number', description: 'Estimated calories burned' },
        date: { type: 'string', description: 'Calendar day this workout belongs to as YYYY-MM-DD. Set it when the user refers to a previous day; omit for today.' },
      },
      required: ['description', 'workoutType', 'durationMinutes', 'caloriesBurned'],
    },
  },
  {
    name: 'update_food_log',
    description: 'Update an existing food entry when the user revises it (e.g. corrects the quantity, the food, or its macros). Only include the fields that change.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the food log entry to update (from the log list)' },
        description: { type: 'string', description: 'Human-readable food description' },
        calories: { type: 'number', description: 'Estimated total calories (kcal)' },
        proteinG: { type: 'number', description: 'Estimated protein in grams' },
        carbsG: { type: 'number', description: 'Estimated carbohydrates in grams' },
        fatG: { type: 'number', description: 'Estimated fat in grams' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] },
        date: { type: 'string', description: 'Corrected calendar day as YYYY-MM-DD, if the user moves the entry to another day.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_workout_log',
    description: 'Update an existing workout entry when the user revises it (e.g. corrects the duration or calories burned). Only include the fields that change.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the workout log entry to update (from the log list)' },
        description: { type: 'string', description: 'Human-readable workout description' },
        workoutType: { type: 'string', description: 'Type of workout (e.g. running, cycling, weightlifting)' },
        durationMinutes: { type: 'number', description: 'Duration in minutes' },
        caloriesBurned: { type: 'number', description: 'Estimated calories burned' },
        date: { type: 'string', description: 'Corrected calendar day as YYYY-MM-DD, if the user moves the entry to another day.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_food_log',
    description: 'Delete a food log entry by ID.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'delete_workout_log',
    description: 'Delete a workout log entry by ID.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
]

async function executeTool(toolName: string, toolInput: Record<string, unknown>, userId: string, rawInput: string): Promise<string> {
  if (toolName === 'save_food_log') {
    const input = toolInput as { description: string; calories: number; proteinG: number; carbsG: number; fatG: number; mealType: string; date?: string }
    const resolved = resolveEntryDate(input.date)
    const [log] = await db.insert(foodLogs).values({
      id: generateId(),
      userId,
      description: input.description,
      calories: Math.round(input.calories),
      proteinG: Math.round(input.proteinG * 10) / 10,
      carbsG: Math.round(input.carbsG * 10) / 10,
      fatG: Math.round(input.fatG * 10) / 10,
      mealType: input.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other',
      source: 'agent',
      rawInput,
      date: resolved.date,
      loggedAt: resolved.loggedAt,
    }).returning()
    return JSON.stringify({ success: true, logId: log.id })
  }

  if (toolName === 'save_workout_log') {
    const input = toolInput as { description: string; workoutType: string; durationMinutes: number; caloriesBurned: number; date?: string }
    const resolved = resolveEntryDate(input.date)
    const [log] = await db.insert(workoutLogs).values({
      id: generateId(),
      userId,
      description: input.description,
      workoutType: input.workoutType,
      durationMinutes: Math.round(input.durationMinutes),
      caloriesBurned: Math.round(input.caloriesBurned),
      source: 'agent',
      rawInput,
      date: resolved.date,
      loggedAt: resolved.loggedAt,
    }).returning()
    return JSON.stringify({ success: true, logId: log.id })
  }

  if (toolName === 'update_food_log') {
    const input = toolInput as { id: string; description?: string; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; mealType?: string; date?: string }
    const updated = await db
      .update(foodLogs)
      .set({
        ...(input.description !== undefined && { description: input.description }),
        ...(input.calories !== undefined && { calories: Math.round(input.calories) }),
        ...(input.proteinG !== undefined && { proteinG: Math.round(input.proteinG * 10) / 10 }),
        ...(input.carbsG !== undefined && { carbsG: Math.round(input.carbsG * 10) / 10 }),
        ...(input.fatG !== undefined && { fatG: Math.round(input.fatG * 10) / 10 }),
        ...(input.mealType !== undefined && { mealType: input.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' }),
        ...(input.date !== undefined && { date: input.date }),
      })
      .where(and(eq(foodLogs.id, input.id), eq(foodLogs.userId, userId)))
      .returning()
    if (updated.length === 0) return JSON.stringify({ error: 'Food log not found' })
    return JSON.stringify({ success: true, logId: updated[0].id })
  }

  if (toolName === 'update_workout_log') {
    const input = toolInput as { id: string; description?: string; workoutType?: string; durationMinutes?: number; caloriesBurned?: number; date?: string }
    const updated = await db
      .update(workoutLogs)
      .set({
        ...(input.description !== undefined && { description: input.description }),
        ...(input.workoutType !== undefined && { workoutType: input.workoutType }),
        ...(input.durationMinutes !== undefined && { durationMinutes: Math.round(input.durationMinutes) }),
        ...(input.caloriesBurned !== undefined && { caloriesBurned: Math.round(input.caloriesBurned) }),
        ...(input.date !== undefined && { date: input.date }),
      })
      .where(and(eq(workoutLogs.id, input.id), eq(workoutLogs.userId, userId)))
      .returning()
    if (updated.length === 0) return JSON.stringify({ error: 'Workout log not found' })
    return JSON.stringify({ success: true, logId: updated[0].id })
  }

  if (toolName === 'delete_food_log') {
    const { id } = toolInput as { id: string }
    await db.delete(foodLogs).where(and(eq(foodLogs.id, id), eq(foodLogs.userId, userId)))
    return JSON.stringify({ success: true })
  }

  if (toolName === 'delete_workout_log') {
    const { id } = toolInput as { id: string }
    await db.delete(workoutLogs).where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)))
    return JSON.stringify({ success: true })
  }

  return JSON.stringify({ error: 'Unknown tool' })
}

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/message', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const result = AgentMessageSchema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten().fieldErrors })
    const { content, sessionId } = result.data

    // Save user message + load history + build prompt concurrently.
    const [, history, systemPrompt] = await Promise.all([
      db.insert(agentMessages).values({
        id: generateId(),
        userId: request.userId,
        sessionId,
        role: 'user',
        content,
      }),
      db
        .select()
        .from(agentMessages)
        .where(and(eq(agentMessages.userId, request.userId), eq(agentMessages.sessionId, sessionId)))
        .orderBy(desc(agentMessages.createdAt))
        .limit(20),
      buildSystemPrompt(request.userId),
    ])

    const messages: Anthropic.MessageParam[] = history
      .reverse()
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    messages.push({ role: 'user', content })

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    let fullResponse = ''
    const toolsUsed: string[] = []

    try {
      const currentMessages = [...messages]

      while (true) {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6', // ['claude-sonnet-4-6','claude-sonnet-4-5','claude-sonnet-4-20250514','claude-3-7-sonnet-latest','claude-3-5-sonnet-20241022']
          max_tokens: 2048,
          system: systemPrompt,
          messages: currentMessages,
          tools: TOOLS,
        })

        let turnText = ''

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            turnText += event.delta.text
            sendEvent('delta', { text: event.delta.text })
          }
        }

        const response = await stream.finalMessage()
        fullResponse += turnText

        if (response.stop_reason === 'tool_use') {
          currentMessages.push({ role: 'assistant', content: response.content })

          const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              toolsUsed.push(block.name)
              sendEvent('tool_use', { tool: block.name })
              const toolResult = await executeTool(block.name, block.input as Record<string, unknown>, request.userId, content)
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: toolResult,
              })
            }
          }

          currentMessages.push({ role: 'user', content: toolResultBlocks })
          continue
        }

        break
      }

      // Save assistant response
      if (fullResponse) {
        await db.insert(agentMessages).values({
          id: generateId(),
          userId: request.userId,
          sessionId,
          role: 'assistant',
          content: fullResponse,
        })
      }

      sendEvent('done', { toolsUsed })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      request.log.error({ err }, 'agent stream error')
      sendEvent('error', { message })
    } finally {
      reply.raw.end()
    }
  })

  // GET /api/v1/agent/messages — conversation history for the current (Jakarta) date.
  // `created_at` is a `timestamp without time zone` holding Jakarta wall-clock (now() runs on
  // the Jakarta-pinned session). Drizzle serializes JS Date params to UTC for these columns,
  // which would shift the day window by 7h — so we compare against naive Jakarta-day bounds
  // built from the date string instead, independent of driver/session/process timezone.
  fastify.get('/messages', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const todayStr = toDateStr()
    const tomorrowStr = shiftDateStr(todayStr, 1)
    const messages = await db
      .select({
        id: agentMessages.id,
        role: agentMessages.role,
        content: agentMessages.content,
        createdAt: agentMessages.createdAt,
      })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.userId, request.userId),
        gte(agentMessages.createdAt, sql`${todayStr}::timestamp`),
        lt(agentMessages.createdAt, sql`${tomorrowStr}::timestamp`),
      ))
      .orderBy(agentMessages.createdAt)

    return reply.send({ messages })
  })

  // GET /api/v1/agent/history — fetch session message history
  fastify.get('/history/:sessionId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const messages = await db
      .select()
      .from(agentMessages)
      .where(and(eq(agentMessages.userId, request.userId), eq(agentMessages.sessionId, sessionId)))
      .orderBy(agentMessages.createdAt)

    return reply.send({ messages })
  })
}
