# Calora

Self-hosted, AI-powered calorie and wellness tracker. Calora combines reviewed AI estimates, manual logging, weight trends, local reminders, and an offline-capable daily dashboard.

See [calora-web-prd.md](calora-web-prd.md) for the product requirements.

## Stack
- **Web**: React 18 + Vite 5 + Tailwind v4 + shadcn/ui + Recharts
- **API**: Fastify v5 + Drizzle ORM + PostgreSQL 16
- **AI**: OpenAI Responses API via the official `openai` SDK; editable food/workout estimates and a read-only streaming coach
- **Monorepo**: pnpm Workspaces

## Quick start (dev)

```bash
# 1. Copy env file and fill in secrets
cp .env.example .env
# Set OPENAI_API_KEY and rotate JWT_SECRET / JWT_REFRESH_SECRET

# 2. Install dependencies
pnpm install

# 3. Start Postgres
docker compose up -d db

# The local database is available at localhost:5435.

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
