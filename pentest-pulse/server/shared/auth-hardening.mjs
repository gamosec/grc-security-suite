/**
 * auth-hardening.mjs
 * ==================
 * Production-grade authentication for the GRC Suite, applied at the Node server
 * layer WITHOUT modifying the (read-only) application source. The Cloudflare
 * Pages production build stays byte-for-byte unchanged; the self-hosted / on-prem
 * deployment gets a hardened login that is safe to put in front of real users.
 *
 * Strategy: the middleware *fully owns* POST /api/auth/login (it does not
 * delegate to the bundled app's insecure handler). It:
 *
 *   1. Refuses the hardcoded universal master password ('CisoHub@2026') unless
 *      an explicit, loudly-warned opt-in env var is set (admin recovery only).
 *
 *   2. Verifies credentials with bcrypt when the stored hash is bcrypt, and
 *      falls back to the app's legacy SHA-256(password + salt) for pre-existing
 *      accounts — transparently re-hashing them to bcrypt on success
 *      ("upgrade on login").
 *
 *   3. Issues the SAME JWT-in-cookie that the application expects, so every
 *      downstream route keeps working unchanged.
 *
 *   4. Validates that production secrets (JWT_SECRET, SYNC_KEY) are not left at
 *      built-in defaults, refusing to boot insecurely in production.
 */

import bcrypt from 'bcryptjs'

const LEGACY_MASTER_PASSWORD = 'CisoHub@2026'
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)

const masterPasswordAllowed = () =>
  String(process.env.ALLOW_MASTER_PASSWORD || '').toLowerCase() === 'true'
const legacyHashAllowed = () =>
  String(process.env.ALLOW_LEGACY_SHA256 || 'true').toLowerCase() === 'true'

// --------------------------------------------------------------------------- //
// Hashing
// --------------------------------------------------------------------------- //

async function sha256Hex(input) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function isBcryptHash(h) {
  return typeof h === 'string' && /^\$2[aby]\$\d{2}\$/.test(h)
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  let diff = a.length ^ b.length
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/**
 * @returns {{ ok: boolean, needsUpgrade: boolean }}
 */
export async function verifyPassword(password, storedHash, legacyHashFn) {
  if (!storedHash) return { ok: false, needsUpgrade: false }
  if (isBcryptHash(storedHash)) {
    return { ok: await bcrypt.compare(password, storedHash), needsUpgrade: false }
  }
  if (legacyHashAllowed() && legacyHashFn) {
    const candidate = await legacyHashFn(password)
    const ok = timingSafeEqualHex(candidate, storedHash)
    return { ok, needsUpgrade: ok }
  }
  return { ok: false, needsUpgrade: false }
}

// --------------------------------------------------------------------------- //
// JWT (must match the application's format: HS256 over base64url(header).payload)
// --------------------------------------------------------------------------- //

function b64url(bytesOrStr) {
  const b = typeof bytesOrStr === 'string' ? Buffer.from(bytesOrStr, 'utf8') : Buffer.from(bytesOrStr)
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = b64url(JSON.stringify(header))
  const payloadB64 = b64url(JSON.stringify(payload))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB64}.${payloadB64}`))
  const sigB64 = b64url(new Uint8Array(sig))
  return `${headerB64}.${payloadB64}.${sigB64}`
}

// --------------------------------------------------------------------------- //
// Secret validation at boot
// --------------------------------------------------------------------------- //

export function validateSecrets({ serviceName = 'app' } = {}) {
  const isProd = process.env.NODE_ENV === 'production'
  const allowInsecure = String(process.env.ALLOW_INSECURE_DEFAULTS || '').toLowerCase() === 'true'
  const problems = []

  if (!process.env.JWT_SECRET) {
    problems.push('JWT_SECRET is not set (a hardcoded signing key would be used — sessions can be forged).')
  }
  if (!process.env.SYNC_KEY) {
    problems.push('SYNC_KEY is not set (cross-system sync uses a hardcoded shared key).')
  }
  if (masterPasswordAllowed()) {
    problems.push('ALLOW_MASTER_PASSWORD=true — the universal master password is ENABLED. Recovery use only.')
  }
  if (problems.length === 0) return

  const banner = `\n[${serviceName}] ⚠️  SECURITY WARNINGS:\n` + problems.map((p) => '   - ' + p).join('\n') + '\n'
  if (isProd && !allowInsecure) {
    throw new Error(
      banner +
        '\nRefusing to start in production with insecure defaults.\n' +
        'Set JWT_SECRET and SYNC_KEY (leave ALLOW_MASTER_PASSWORD unset), or set ALLOW_INSECURE_DEFAULTS=true to override.\n',
    )
  }
  // eslint-disable-next-line no-console
  console.warn(banner + '   (continuing because NODE_ENV is not "production")\n')
}

// --------------------------------------------------------------------------- //
// Login takeover middleware
// --------------------------------------------------------------------------- //

/**
 * Build a Hono middleware that fully handles POST /api/auth/login.
 *
 * @param {object} opts
 * @param {string} opts.appSalt         per-app static salt used by the legacy SHA-256 hash
 * @param {string} opts.jwtSecret       secret to sign sessions (must equal the app's expected secret)
 * @param {string} opts.usersTable      relation holding credentials (e.g. 'users_new' or 'users')
 * @param {string} opts.orgTable        organizations table for the join (or null to skip)
 * @param {string} opts.cookieName      session cookie name (default 'session')
 * @param {number} opts.ttlSeconds      session lifetime (cookie Max-Age, seconds)
 * @param {(user:any)=>object} opts.buildPayload   maps a user row -> COMPLETE JWT
 *        payload. This MUST include whatever expiry field the app's verifier
 *        expects (e.g. GRC uses `exp` in milliseconds; Pentest uses `iat`/`exp`
 *        in seconds), because the two systems differ.
 * @param {(user:any)=>object} opts.buildUserResponse  maps a user row -> JSON user object
 * @param {string} opts.loginPath       login route path (default '/api/auth/login')
 * @param {boolean} opts.requireActiveStatus  filter on u.status='active' (default true)
 * @param {string} opts.serviceName
 */
export function createSecureLogin(opts) {
  const {
    appSalt,
    jwtSecret,
    usersTable = 'users',
    orgTable = 'organizations',
    cookieName = 'session',
    ttlSeconds = 24 * 60 * 60,
    buildPayload,
    buildUserResponse,
    loginPath = '/api/auth/login',
    requireActiveStatus = true,
    serviceName = 'app',
  } = opts

  const legacyHashFn = (pw) => sha256Hex(pw + appSalt)

  return async function secureLogin(c, next) {
    if (c.req.method.toUpperCase() !== 'POST' || c.req.path !== loginPath) {
      return next()
    }

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    const email = body?.email
    const password = body?.password
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }

    // Block the universal master password unless explicitly allowed.
    if (password === LEGACY_MASTER_PASSWORD && !masterPasswordAllowed()) {
      console.warn(`[${serviceName}] blocked master-password login for ${email}`)
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    const db = c.env?.DB
    if (!db) return c.json({ error: 'Authentication unavailable' }, 500)

    // Look up the user (+ org name when available). Email match is
    // case-insensitive (LOWER(email) = LOWER(?)) to mirror the apps, which
    // variously normalise the address before lookup. The active-status filter
    // is opt-in because not every users table has a `status` column.
    const statusClause = requireActiveStatus ? " AND u.status = 'active'" : ''
    let user
    try {
      const join = orgTable
        ? `SELECT u.*, o.name AS org_name FROM ${usersTable} u JOIN ${orgTable} o ON u.organization_id = o.id WHERE LOWER(u.email) = LOWER(?)${statusClause}`
        : `SELECT u.* FROM ${usersTable} u WHERE LOWER(u.email) = LOWER(?)${statusClause}`
      user = await db.prepare(join).bind(email).first()
    } catch (err) {
      // Fall back to a no-join lookup if the schema differs.
      try {
        user = await db.prepare(`SELECT * FROM ${usersTable} WHERE LOWER(email) = LOWER(?)`).bind(email).first()
      } catch (e2) {
        console.error(`[${serviceName}] login lookup failed:`, e2?.message)
        return c.json({ error: 'Authentication failed' }, 500)
      }
    }
    if (!user) return c.json({ error: 'Invalid email or password' }, 401)

    // Allow the master password ONLY when explicitly enabled (recovery).
    let authed = false
    if (password === LEGACY_MASTER_PASSWORD && masterPasswordAllowed()) {
      authed = true
    } else {
      const { ok, needsUpgrade } = await verifyPassword(password, user.password_hash, legacyHashFn)
      authed = ok
      if (ok && needsUpgrade) {
        try {
          const newHash = await hashPassword(password)
          await db.prepare(`UPDATE ${usersTable} SET password_hash = ? WHERE id = ?`).bind(newHash, user.id).run()
          console.log(`[${serviceName}] upgraded password to bcrypt for user ${user.id}`)
        } catch (err) {
          console.warn(`[${serviceName}] bcrypt upgrade failed (non-fatal):`, err?.message)
        }
      }
    }

    if (!authed) return c.json({ error: 'Invalid email or password' }, 401)

    // Issue the application-compatible session. buildPayload owns expiry
    // semantics (GRC: exp in ms; Pentest: iat/exp in seconds).
    const payload = buildPayload(user)
    const token = await signJWT(payload, jwtSecret)
    const secureFlag = process.env.NODE_ENV === 'production'
    c.header(
      'Set-Cookie',
      `${cookieName}=${token}; HttpOnly; ${secureFlag ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`,
    )

    // Best-effort audit log (never blocks login).
    try {
      await db
        .prepare(
          `INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, 'login', 'user', ?, now())`,
        )
        .bind('audit-' + Math.random().toString(36).slice(2, 14), user.organization_id, user.id, user.id)
        .run()
    } catch { /* table may not exist in every schema */ }

    return c.json({ success: true, user: buildUserResponse(user) })
  }
}
