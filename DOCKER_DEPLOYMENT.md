# 🐳 GRC Security Suite — On-Prem / Docker Deployment

This guide describes the **self-hosted** deployment that runs the entire suite on
PostgreSQL + Docker, with **Ollama** for local AI. The existing **Cloudflare
Pages production deployment is unchanged** — these artifacts live alongside the
original Cloudflare config (`wrangler.jsonc`, `functions/`, `vite.config.ts`).

## Architecture

```
                ┌──────────────┐
   :3001  ─────►│  AutoAudit   │──┐
                └──────────────┘  │
                ┌──────────────┐  │   ┌──────────────┐
   :3002  ─────►│  GRC Pulse   │──┼──►│  PostgreSQL  │  (schemas:
                └──────────────┘  │   └──────────────┘   grc_pulse,
                ┌──────────────┐  │   ┌──────────────┐   pentest_pulse,
   :3003  ─────►│ Pentest Pulse│──┘   │    Ollama    │   autoaudit)
                └──────────────┘      └──────────────┘
```

- **Database**: one PostgreSQL instance, one database (`grc_suite`), three
  schemas so the apps never collide.
- **AI**: pluggable via `AI_PROVIDER` — `ollama` (default), `openai`, or `none`.
- **Compatibility**: the apps keep using the Cloudflare D1 API
  (`DB.prepare().bind().first()/.all()/.run()/.batch()`) and the Workers-AI API
  (`AI.run()`); both are emulated by small adapters in `*/server/shared/`.

## Quick start

```bash
cp .env.example .env          # set DB_PASSWORD, JWT_SECRET, AI provider
docker compose up -d --build

# Pull a local model for Ollama (first run only)
docker compose exec ollama ollama pull llama3.1:8b
```

Then open:

| App           | URL                     |
|---------------|-------------------------|
| AutoAudit     | http://localhost:3001   |
| GRC Pulse     | http://localhost:3002   |
| Pentest Pulse | http://localhost:3003   |

## Database initialisation

On the **first** boot of the `postgres` container, the files in
`docker/db/init/` are executed in order:

| File | Purpose |
|------|---------|
| `10_grc_pulse_schema.sql`     | GRC Pulse tables / indexes / views (DDL) |
| `20_pentest_pulse_schema.sql` | Pentest Pulse tables / indexes (DDL) |
| `30_autoaudit_schema.sql`     | AutoAudit session tables (DDL) |
| `40_grc_pulse_data.sql`       | GRC Pulse seed + demo data (one transaction, deferred FKs) |
| `50_pentest_pulse_data.sql`   | Pentest Pulse seed + demo data |

These are **auto-generated** from the original D1 migrations + `seed.sql` by:

```bash
python3 docker/scripts/convert_migrations.py
```

The converter handles the SQLite→PostgreSQL differences automatically:
`datetime('now')` → `now()`, `date('now','-6 months')` → interval math,
`REAL` → `DOUBLE PRECISION`, `AUTOINCREMENT` → `BIGSERIAL`,
`lower(hex(randomblob(8)))` → `encode(gen_random_bytes(8),'hex')`,
`instr()` → `position()`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`,
`CREATE VIEW IF NOT EXISTS` → `CREATE OR REPLACE VIEW`, and schema-qualifies
every table/view name. The generated schema has been validated against
PostgreSQL 17.

To re-seed from scratch:

```bash
docker compose down -v        # WARNING: deletes the postgres volume
docker compose up -d --build
```

## AI providers

| `AI_PROVIDER` | Requirements | Notes |
|---------------|--------------|-------|
| `ollama` (default) | `docker compose exec ollama ollama pull <model>` | Fully on-prem, no keys |
| `openai`      | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL` for Azure) | Cloud or Azure OpenAI |
| `none`        | — | AI endpoints return a friendly "disabled" message |

Model mapping: the apps request Cloudflare model ids (e.g.
`@cf/meta/llama-3.1-8b-instruct`); the adapter maps these to `OLLAMA_MODEL` or
`OPENAI_MODEL`. Override globally with `AI_MODEL`.

## Local development (without Docker)

Each app's Node runtime lives in `*/server/`:

```bash
# Postgres must be running and initialised with docker/db/init/*.sql
cd grc-pulse/server && npm install && npm run dev   # build bundle + start
```

Environment variables: `DATABASE_URL`, `DB_SCHEMA`, `AI_PROVIDER`, `PORT`.

## What was added (and what was preserved)

**Added (on-prem only):**
- `docker-compose.yml`, `.env.example`, `DOCKER_DEPLOYMENT.md`
- `docker/db/init/*.sql` (generated PostgreSQL schema + data)
- `docker/scripts/convert_migrations.py` (D1→PG converter)
- `docker/shared/{d1-pg-adapter,ai-adapter}.mjs` (reference copies)
- `*/Dockerfile`
- `*/server/` (Node entrypoint, esbuild bundler, adapters, CF shim)

**Preserved (Cloudflare production):**
- `*/wrangler.jsonc`, `*/vite.config.ts`, `*/migrations/*.sql`, `*/seed.sql`
- `grc-pulse/src/index.tsx`, `pentest-pulse/src/index.tsx` (unchanged)
- `autoaudit/functions/api/*.js`, `autoaudit/src/**` (unchanged)
```
