/**
 * http.mjs — tiny integration-test helpers for the GRC Suite on-prem stack.
 *
 * These talk to a *running* stack (started by docker/scripts/run-local.sh or
 * docker compose) over HTTP, using the same cookie-based sessions the real
 * frontend uses. No framework — just fetch + a cookie jar — so the tests run
 * under the Node built-in test runner with zero extra deps.
 *
 * Configuration (env, with local-stack defaults):
 *   GRC_BASE_URL      default http://localhost:3002
 *   PENTEST_BASE_URL  default http://localhost:3003
 *   SYNC_KEY          default ci-strong-sync-key-def456uvw  (must match the
 *                     value the stack was built/started with)
 *   GRC_EMAIL/PW      default admin@acme.com / GrcDemo!2026
 *   PENTEST_EMAIL/PW  default admin@pentestpulse.io / admin123
 */

export const GRC_BASE_URL = process.env.GRC_BASE_URL || 'http://localhost:3002'
export const PENTEST_BASE_URL = process.env.PENTEST_BASE_URL || 'http://localhost:3003'
export const SYNC_KEY = process.env.SYNC_KEY || 'ci-strong-sync-key-def456uvw'

export const GRC_CREDS = {
  email: process.env.GRC_EMAIL || 'admin@acme.com',
  password: process.env.GRC_PASSWORD || 'GrcDemo!2026',
}
export const PENTEST_CREDS = {
  email: process.env.PENTEST_EMAIL || 'admin@pentestpulse.io',
  password: process.env.PENTEST_PASSWORD || 'admin123',
}

/** Parse Set-Cookie header(s) into a single "name=value; name2=value2" jar. */
function collectCookies(res, jar) {
  // Node's fetch exposes getSetCookie() (undici). Fall back to raw header.
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean)
  for (const line of raw) {
    if (!line) continue
    const [pair] = line.split(';')
    const idx = pair.indexOf('=')
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * A minimal session client bound to one base URL with a persistent cookie jar.
 */
export class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.jar = {}
  }

  async request(method, path, { body, headers = {} } = {}) {
    const h = { ...headers }
    if (Object.keys(this.jar).length) h.cookie = cookieHeader(this.jar)
    if (body !== undefined) h['content-type'] = 'application/json'
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })
    collectCookies(res, this.jar)
    let data = null
    const text = await res.text()
    if (text) { try { data = JSON.parse(text) } catch { data = text } }
    return { status: res.status, data, headers: res.headers }
  }

  get(path, opts) { return this.request('GET', path, opts) }
  post(path, body, opts) { return this.request('POST', path, { ...opts, body }) }
  patch(path, body, opts) { return this.request('PATCH', path, { ...opts, body }) }
  delete(path, opts) { return this.request('DELETE', path, opts) }
}

/** Log into GRC Pulse and return an authenticated client + the org id. */
export async function loginGrc() {
  const c = new Client(GRC_BASE_URL)
  const r = await c.post('/api/auth/login', GRC_CREDS)
  if (r.status !== 200 || !r.data?.success) {
    throw new Error(`GRC login failed: ${r.status} ${JSON.stringify(r.data)}`)
  }
  // /api/auth/me exposes the orgId for assertions that need it.
  const me = await c.get('/api/auth/me')
  const orgId = me.data?.user?.orgId || me.data?.user?.organization_id || null
  return { client: c, user: r.data.user, orgId }
}

/** Log into Pentest Pulse and return an authenticated client. */
export async function loginPentest() {
  const c = new Client(PENTEST_BASE_URL)
  const r = await c.post('/api/auth/login', PENTEST_CREDS)
  if (r.status !== 200 || !r.data?.success) {
    throw new Error(`Pentest login failed: ${r.status} ${JSON.stringify(r.data)}`)
  }
  return { client: c, user: r.data.user }
}

/** True when the stack appears reachable (so tests can self-skip in unit-only CI). */
export async function stackUp(baseUrl = GRC_BASE_URL) {
  try {
    const res = await fetch(baseUrl + '/healthz', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
