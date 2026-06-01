# Calora

Self-hosted, AI-powered calorie tracking app. Dual-panel UX: chat with Claude on the left, real-time visualizations on the right.

See [PRD_CalorieTracker_App.md](PRD_CalorieTracker_App.md) for full specs and [implementation-plan.md](implementation-plan.md) for progress.

## Stack
- **Web**: React 18 + Vite 5 + Tailwind v4 + shadcn/ui + Recharts
- **API**: Fastify v5 + Drizzle ORM + PostgreSQL 16
- **AI**: Anthropic Claude (`claude-sonnet-4-5`) via SSE streaming + tool use
- **Monorepo**: pnpm Workspaces

## Quick start (dev)

```bash
# 1. Copy env file and fill in secrets
cp .env.example .env
# Set ANTHROPIC_API_KEY and rotate JWT_SECRET / JWT_REFRESH_SECRET

# 2. Install dependencies
pnpm install

# 3. Start Postgres
docker compose up -d db

# 4. Push DB schema (dev) or generate + run migrations
pnpm db:push

# 5. Run web + api together
pnpm dev
# web → http://localhost:5173
# api → http://localhost:3001
```

## Production (Docker)

```bash
cp .env.example .env  # set all secrets
docker compose up -d --build
# app → http://localhost
```

## Project layout

```
apps/
  web/   React + Vite frontend
  api/   Fastify backend
packages/
  shared/ Types, Zod schemas, BMR/TDEE math (imported by web and api)
```

## Key commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run web + api in parallel |
| `pnpm db:push` | Push Drizzle schema to DB (dev) |
| `pnpm db:generate` | Generate SQL migration from schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Typecheck all workspaces |
