# Pactolus

Pactolus is a web-based, multi-tenant transaction comps engine for finance teams.

## Monorepo Layout

```text
apps/
  api/      Express + tRPC backend
  web/      Next.js app scaffold
  worker/   Temporal worker scaffold
packages/
  db/         Drizzle schema and migrations
  validation/ Zod schemas
  rbac/       CASL role/ability layer
  shared/     Shared constants and types
infra/
  docker/   Local infrastructure definitions
```

## Prerequisites

- Docker Desktop installed and running
- Node.js 20+
- `pnpm` via Corepack (`corepack enable`)

## First-Time Setup

1) Copy environment variables

```bash
cp .env.example .env
```

2) Install workspace dependencies

```bash
corepack pnpm install --no-frozen-lockfile
```

## Local Postgres

1) Start Postgres container

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

2) Confirm container health

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

3) Test database connectivity

```bash
docker compose -f infra/docker/docker-compose.yml exec postgres psql -U pactolus -d pactolus -c "select now();"
```

4) Run database migrations

```bash
corepack pnpm --filter @pactolus/db db:migrate
```

5) Seed local sample data

```bash
corepack pnpm --filter @pactolus/db db:seed
```

6) Stop Postgres

```bash
docker compose -f infra/docker/docker-compose.yml down
```

7) Stop and delete local DB data (reset)

```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

## Running Services

Start API:

```bash
corepack pnpm --filter @pactolus/api dev
```

Health check:

```bash
curl http://localhost:4000/healthz
```

tRPC endpoint base:

```bash
http://localhost:4000/trpc
```

Tenant-scoped calls require headers:

- `x-org-id: <organization-uuid>`
- `x-user-id: <user-uuid>` (required for mutation procedures)

## Useful Commands

```bash
# Typecheck every workspace
corepack pnpm -r typecheck

# Generate a new migration after schema changes
corepack pnpm --filter @pactolus/db db:generate

# Open Drizzle Studio
corepack pnpm --filter @pactolus/db db:studio
```