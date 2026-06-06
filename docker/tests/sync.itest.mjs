/**
 * sync.itest.mjs — integration test for GRC Pulse <-> Pentest Pulse sync.
 *
 * This is the cross-system flow that makes the suite more than three separate
 * apps: GRC Pulse pulls pentest findings from Pentest Pulse over HTTP (authed
 * with X-Sync-Key) and reconciles them into risks. The test asserts:
 *
 *   1. The shared SYNC_KEY actually authorises the cross-system call
 *      (and a wrong key is rejected — no silent open door).
 *   2. Every finding Pentest Pulse exposes is accounted for by the pull
 *      (created + updated == source count, with zero errors). This is the
 *      automated version of the "8 == 8" reconciliation we previously checked
 *      by hand.
 *
 * Runs against a live stack; self-skips if it is not reachable.
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { loginGrc, stackUp, PENTEST_BASE_URL, SYNC_KEY } from './helpers/http.mjs'

let client
let orgId
let available = false

before(async () => {
  available = (await stackUp()) && (await stackUp(PENTEST_BASE_URL))
  if (available) ({ client, orgId } = await loginGrc())
})

const skipIfDown = (t) => {
  if (!available) {
    t.skip('GRC + Pentest stack not both reachable (docker/scripts/run-local.sh start)')
    return true
  }
  return false
}

/** Fetch the findings Pentest Pulse exposes for an org (the source of truth). */
async function pentestFindings(orgId, syncKey) {
  const res = await fetch(`${PENTEST_BASE_URL}/api/external/findings?org_id=${orgId}`, {
    headers: { 'X-Sync-Key': syncKey },
  })
  const body = await res.json().catch(() => ({}))
  const list = body.findings || body.results || (Array.isArray(body) ? body : [])
  return { status: res.status, count: Array.isArray(list) ? list.length : 0 }
}

test('sync auth: correct SYNC_KEY authorises, wrong key is rejected', async (t) => {
  if (skipIfDown(t)) return

  const ok = await pentestFindings(orgId, SYNC_KEY)
  assert.equal(ok.status, 200, 'valid sync key should be accepted (200)')

  const bad = await fetch(`${PENTEST_BASE_URL}/api/external/findings?org_id=${orgId}`, {
    headers: { 'X-Sync-Key': 'definitely-not-the-key' },
  })
  assert.equal(bad.status, 401, 'wrong sync key must be rejected (401)')
})

test('sync pull: GRC reconciles every Pentest finding with no errors', async (t) => {
  if (skipIfDown(t)) return

  // Source of truth: how many findings does Pentest Pulse expose?
  const source = await pentestFindings(orgId, SYNC_KEY)
  assert.equal(source.status, 200)
  assert.ok(source.count > 0, 'demo data should expose at least one finding')

  // Trigger the GRC-side pull.
  const pull = await client.post('/api/sync/pentest/pull', {})
  assert.equal(pull.status, 200, `sync pull should 200, got ${pull.status}: ${JSON.stringify(pull.data)}`)
  assert.equal(pull.data.success, true)

  const r = pull.data.results
  assert.ok(r, 'pull returns a results summary')
  assert.deepEqual(r.errors, [], 'sync must complete with zero errors')

  // Reconciliation: total handled == findings handled (created + updated), and
  // that equals the number Pentest Pulse exposed. This is the "8 == 8" check.
  assert.equal(r.total, source.count, `pull total (${r.total}) must equal source findings (${source.count})`)
  assert.equal(
    (r.created || 0) + (r.updated || 0),
    source.count,
    'every source finding is either created or updated by the pull',
  )
})

test('sync pull: is idempotent (a second pull creates nothing new)', async (t) => {
  if (skipIfDown(t)) return

  await client.post('/api/sync/pentest/pull', {}) // ensure baseline synced
  const second = await client.post('/api/sync/pentest/pull', {})
  assert.equal(second.status, 200)
  assert.equal(second.data.results.created, 0, 're-pull should create 0 new risks (idempotent)')
  assert.deepEqual(second.data.results.errors, [], 're-pull has no errors')
})
