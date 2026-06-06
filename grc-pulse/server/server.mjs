/**
 * GRC Pulse - Node.js / Docker server entrypoint
 * ===============================================
 * Runs the existing Hono application (src/index.tsx, exported as `default`)
 * on Node.js using @hono/node-server, with PostgreSQL and the AI adapter
 * injected into `c.env` so the application code remains unchanged.
 *
 * The original Cloudflare Pages build (vite.config.ts / wrangler.jsonc) is
 * left intact — this file is only used inside the Docker / on-prem deployment.
 */

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createD1Adapter, waitForDatabase } from './shared/d1-pg-adapter.mjs'
import { createAIAdapter } from './shared/ai-adapter.mjs'
import { createSecureLogin, validateSecrets } from './shared/auth-hardening.mjs'

// The application is bundled by esbuild to ./dist-server/app.mjs
import app from './dist-server/app.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT || '3000', 10)
const SCHEMA = process.env.DB_SCHEMA || 'grc_pulse'
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://grc:grc@postgres:5432/grc_suite'

// JWT signing secret for the hardened login. MUST equal the secret the bundled
// app verifies with — build.mjs rewrites the app's hardcoded secret from this
// same env var (with the production string as the default), so they always
// match whether or not JWT_SECRET is set.
const JWT_SECRET = process.env.JWT_SECRET || 'grc-pulse-jwt-v5-2026'
// GRC Pulse legacy SHA-256 salt (matches src/index.tsx: password + 'grc-pulse-salt').
const APP_SALT = 'grc-pulse-salt'

async function main() {
  console.log('[grc-pulse] waiting for database...')
  validateSecrets({ serviceName: 'grc-pulse' })
  await waitForDatabase(DATABASE_URL)

  const db = createD1Adapter({ connectionString: DATABASE_URL, schema: SCHEMA })
  const ai = createAIAdapter()

  // Root app: injects env, serves static assets, then delegates to the
  // existing application.
  const root = new Hono()

  // Inject Cloudflare-compatible bindings into every request's env.
  root.use('*', async (c, next) => {
    c.env = c.env || {}
    c.env.DB = db
    c.env.AI = ai
    await next()
  })

  // Static assets (served from ./public in the original project).
  const publicDir = path.join(__dirname, 'public')
  if (existsSync(publicDir)) {
    root.use('/static/*', serveStatic({ root: path.relative(process.cwd(), publicDir) || '.' }))
  }

  // Hardened login: fully owns POST /api/auth/login (bcrypt + master-password
  // block + legacy upgrade-on-login) BEFORE delegating to the app. It issues
  // the exact JWT-in-cookie the app's verifyJWT expects, so every downstream
  // route keeps working unchanged. Registered before root.route so it wins.
  root.use(
    createSecureLogin({
      serviceName: 'grc-pulse',
      appSalt: APP_SALT,
      jwtSecret: JWT_SECRET,
      usersTable: 'users_new',
      orgTable: 'organizations',
      cookieName: 'session',
      ttlSeconds: 24 * 60 * 60,
      // GRC's verifyJWT compares payload.exp (milliseconds) against Date.now().
      buildPayload: (user) => ({
        userId: user.id,
        email: user.email,
        name: user.display_name || user.email,
        orgId: user.organization_id,
        role: user.role || 'viewer',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      }),
      buildUserResponse: (user) => ({
        id: user.id,
        email: user.email,
        name: user.display_name,
        role: user.role,
        organization: user.org_name,
      }),
    }),
  )

  // Delegate everything else to the original Hono app.
  root.route('/', app)

  // Health endpoint for docker-compose healthchecks.
  root.get('/healthz', (c) => c.json({ status: 'ok', service: 'grc-pulse' }))

  serve({ fetch: root.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
    console.log(`[grc-pulse] listening on http://0.0.0.0:${info.port} (schema=${SCHEMA})`)
  })
}

main().catch((err) => {
  console.error('[grc-pulse] fatal:', err)
  process.exit(1)
})
