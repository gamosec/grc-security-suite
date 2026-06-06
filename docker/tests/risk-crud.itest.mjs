/**
 * risk-crud.itest.mjs — integration test for the Risk lifecycle (GRC Pulse).
 *
 * Exercises the path a GRC buyer actually pays for: create a risk, read it
 * back, update it, and delete it — asserting the server-computed risk score
 * along the way. Runs against a live stack; self-skips (with a clear message)
 * if the stack is not reachable, so the unit-only CI lane stays green.
 *
 * Scoring contract under test (grc-pulse/src/index.tsx):
 *   inherent_score = round(inherent_likelihood * inherent_impact * 100)
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { loginGrc, stackUp } from './helpers/http.mjs'

let client
let available = false

before(async () => {
  available = await stackUp()
  if (available) ({ client } = await loginGrc())
})

const skipIfDown = (t) => {
  if (!available) {
    t.skip('GRC stack not reachable (start it with docker/scripts/run-local.sh start)')
    return true
  }
  return false
}

test('risk CRUD: create -> read -> update -> delete with correct scoring', async (t) => {
  if (skipIfDown(t)) return

  // ----- CREATE ------------------------------------------------------------
  const payload = {
    title: 'ITEST Unencrypted backups',
    description: 'Backups stored without encryption at rest.',
    category: 'operational',
    inherent_likelihood: 0.5,
    inherent_impact: 0.8,
    status: 'open',
  }
  const created = await client.post('/api/risks', payload)
  assert.equal(created.status, 201, `create should 201, got ${created.status}: ${JSON.stringify(created.data)}`)
  const risk = created.data
  assert.ok(risk.id, 'created risk has an id')
  assert.equal(risk.title, payload.title)
  assert.equal(risk.status, 'open')
  // Deterministic server-side score: round(0.5 * 0.8 * 100) = 40.
  assert.equal(risk.inherent_score, 40, 'inherent_score must equal round(L*I*100)')
  // A manually-created risk must be tagged 'manual' (not pentest-sourced).
  assert.equal(risk.risk_source, 'manual')

  try {
    // ----- READ (by id) ----------------------------------------------------
    const fetched = await client.get(`/api/risks/${risk.id}`)
    assert.equal(fetched.status, 200)
    assert.equal(fetched.data.id, risk.id)
    assert.equal(fetched.data.inherent_score, 40)

    // ----- READ (in list) --------------------------------------------------
    const list = await client.get('/api/risks')
    assert.equal(list.status, 200)
    const ids = (list.data.risks || []).map((r) => r.id)
    assert.ok(ids.includes(risk.id), 'new risk appears in the list')

    // ----- UPDATE ----------------------------------------------------------
    const patched = await client.patch(`/api/risks/${risk.id}`, {
      status: 'in_progress',
      inherent_impact: 1.0, // 0.5 * 1.0 * 100 = 50
    })
    assert.equal(patched.status, 200, `patch should 200, got ${patched.status}: ${JSON.stringify(patched.data)}`)
    const after = await client.get(`/api/risks/${risk.id}`)
    assert.equal(after.data.status, 'in_progress', 'status update persisted')
    assert.equal(after.data.inherent_score, 50, 'score recomputed after impact change')
  } finally {
    // ----- DELETE (always, even if an assertion above failed) --------------
    const del = await client.delete(`/api/risks/${risk.id}`)
    assert.equal(del.status, 200, 'delete should 200')
    assert.equal(del.data.success, true)
  }

  // ----- VERIFY GONE -------------------------------------------------------
  const gone = await client.get(`/api/risks/${risk.id}`)
  assert.equal(gone.status, 404, 'deleted risk should 404')
})

test('risk read: unauthenticated request is rejected (401)', async (t) => {
  if (skipIfDown(t)) return
  const { Client, GRC_BASE_URL } = await import('./helpers/http.mjs')
  const anon = new Client(GRC_BASE_URL)
  const r = await anon.get('/api/risks')
  assert.equal(r.status, 401, 'no session cookie -> 401')
})
