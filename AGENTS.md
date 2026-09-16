# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Calora** is a self-hosted, AI-powered calorie and nutrition tracking web app. Users log food and workouts via a conversational AI agent (left panel); a visualization dashboard (right panel) updates in real-time. Calorie targets are personalized using Mifflin-St Jeor / TDEE formulas collected during a mandatory onboarding questionnaire.

## Monorepo Structure

pnpm Workspaces monorepo:

```
calora/
├── apps/
│   ├── web/          # React 18 + Vite 5 + Tailwind CSS v4 + shadcn/ui + Recharts
│   └── api/          # Fastify v5 + Drizzle ORM + PostgreSQL 18
├── packages/
│   └── shared/       # Shared TypeScript types, Zod schemas, TDEE/BMR calculation logic
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Commands

### Root (monorepo)
```bash
pnpm install              # install all workspace dependencies
pnpm dev                  # start web + api in parallel (dev mode)
pnpm build                # build all workspaces
pnpm lint                 # lint all workspaces
pnpm typecheck            # tsc --noEmit across all workspaces
pnpm test                 # run all tests
```

### Web (`apps/web`)
```bash
pnpm --filter web dev          # Vite dev server
pnpm --filter web build        # production build
pnpm --filter web typecheck
pnpm --filter web test         # Vitest
```

### API (`apps/api`)
```bash
pnpm --filter api dev          # tsx watch / ts-node dev server
pnpm --filter api build
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api db:migrate   # run Drizzle migrations
pnpm --filter api db:push      # push schema to DB (dev only)
pnpm --filter api db:studio    # open Drizzle Studio
```

### Docker (self-hosted)
```bash
docker compose up -d           # start all services (web, api, db, adminer)
docker compose down
```

## Tech Stack Decisions

| Concern | Choice | Notes |
|---|---|---|
| Styling | Tailwind CSS v4 | CSS-first config via `@import "tailwindcss"` — **no `tailwind.config.js`**; uses Lightning CSS |
| Components | shadcn/ui | Copy-owned Radix UI + Tailwind primitives in `apps/web/src/components/ui/` |
| Charts | Recharts | Composable React chart components |
| ORM | Drizzle ORM | Schema-as-code in `apps/api/src/db/schema.ts`; migrations in `apps/api/src/db/migrations/` |
| Auth | `@fastify/jwt` + `@fastify/cookie` | JWT access token (15 min) + refresh token (30 days) in HttpOnly, SameSite=Strict cookies |
| AI | OpenAI SDK (`openai`) → DeepSeek v4 pro | Official `openai` SDK pointed at DeepSeek's OpenAI-compatible endpoint via `baseURL`; streamed responses via SSE; agent has access to user profile + today's logs |

## Architecture Patterns

### API Route Layout (Fastify)
- Plugin-per-feature pattern using `fastify-plugin`
- Routes registered under `/api/v1/`
- Auth middleware applied globally; public routes: `/api/v1/auth/login`, `/api/v1/auth/register`
- Rate limiting on `/api/v1/auth/login`: 10 attempts / 15 min / IP

### Frontend Layout
- Dual-panel dashboard: left 40% = AI chat, right 60% = visualization tabs (Today | This Week | Macros | Full Log)
- Mobile: panels stack vertically; right panel becomes a bottom sheet/tab
- Onboarding wizard (4-step) blocks dashboard access until `onboarding_complete = true`

### Shared Package
- `packages/shared` contains: TypeScript interfaces for API request/response, Zod validation schemas, BMR/TDEE calculation functions
- Both `apps/web` and `apps/api` import from `@calora/shared`

### TDEE / BMR Calculation
Implemented in `packages/shared/src/calculations.ts`. Use Mifflin-St Jeor:
- Male: `10w + 6.25h − 5a + 5`; Female: `10w + 6.25h − 5a − 161`
- TDEE = BMR × activity multiplier (1.2 / 1.375 / 1.55 / 1.725 / 1.9)
- Calorie target = TDEE ± goal adjustment (±275 / ±550 / ±1100 kcal for mild/moderate/aggressive bulk or cut)

### Workout Calorie Estimation
MET-based: `Calories = MET × weight_kg × duration_hours`. MET values live in `packages/shared/src/constants.ts`.

### AI Agent Integration
- Frontend streams SSE from `POST /api/v1/ai/coach`
- Agent context injected server-side: user profile, today's log
- Agent must not give medical advice; caveat approximations for homemade food; ask one clarifying question when ambiguous

## Database Schema (Core Tables)

- **users**: `id, email, password_hash, display_name, onboarding_complete, created_at`
- **user_profiles**: `user_id, date_of_birth, sex, height_cm, weight_kg, activity_level, goal, goal_intensity, target_weight_kg, daily_calorie_target, updated_at`
- **food_logs**: `id, user_id, logged_at, description, calories, protein_g, carbs_g, fat_g, meal_type, source, raw_input`
- **workout_logs**: `id, user_id, logged_at, description, workout_type, duration_minutes, calories_burned, source, raw_input`
- **agent_messages**: `id, user_id, session_id, role, content, created_at`
- **ai_usage_logs**: `id, user_id, kind, model, prompt_tokens, completion_tokens, total_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens, cost_usd, created_at`

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # access token secret
JWT_REFRESH_SECRET    # refresh token secret
OPENAI_API_KEY        # DeepSeek API key (platform.deepseek.com); never sent to browsers
OPENAI_BASE_URL       # optional; defaults to https://api.deepseek.com (OpenAI-compatible)
OPENAI_MODEL          # optional; defaults to deepseek-v4-pro
AI_DAILY_LIMIT        # optional; daily AI invocations per user
AI_CACHE_TTL_HOURS    # optional; estimate cache TTL
AI_PRICE_INPUT_PER_M  # optional; USD per 1M input tokens (default 0.27)
AI_PRICE_INPUT_CACHE_HIT_PER_M  # optional; USD per 1M cache-hit input tokens (default 0.07)
AI_PRICE_OUTPUT_PER_M # optional; USD per 1M output tokens (default 1.10)
ADMIN_EMAIL           # optional; admin console login (AI cost dashboard at /admin)
ADMIN_PASSWORD        # optional; admin console password (plaintext, timing-safe compare)
SMTP_HOST             # optional SMTP relay host (defaults to Gmail smtp.gmail.com:587)
SMTP_PORT             # optional relay port (default 587; 465 implies implicit TLS)
SMTP_USER             # Gmail address used to send verification emails (service: gmail)
SMTP_PASS             # Gmail App Password (requires 2FA); never sent to browsers
SMTP_FROM             # optional sender address for emails (defaults to SMTP_USER)
APP_URL               # public URL of the app
NODE_ENV              # development | production
```

## Security Requirements

- Passwords: bcrypt (cost ≥ 12) or Argon2; minimum 8 chars, must include letter + number
- All API routes require auth except login/register
- No public data endpoints; no external telemetry
- WCAG 2.1 AA compliance target for all UI
