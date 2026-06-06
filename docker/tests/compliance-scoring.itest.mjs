/**
 * compliance-scoring.itest.mjs — integration test for ISO 27001 compliance
 * scoring (GRC Pulse).
 *
 * Compliance scoring is core GRC business logic, so this asserts it responds
 * correctly and reversibly to control assessments. The assertions are
 * delta-based against whatever the current baseline is, so the test is robust
 * on a fresh CI database AND on a long-lived dev database with pre-existing
 * implemented controls:
 *
 *   1. Implementing N (currently not_started) controls raises the `implemented`
 *      count by exactly N and strictly increases the score (monotonic).
 *   2. Reverting those same controls restores the original count and score
 *      (this guards the datetime("now") UPDATE-path bug, where status
 *      downgrades used to silently fail on PostgreSQL).
 *
 * The test only touches controls it first observed as not_started, and fully
 * restores them, so it is safe to re-run and never assumes a zero baseline.
 * Runs against a live stack; self-skips if it is not reachable.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { loginGrc, stackUp } from './helpers/http.mjs'

let client
let available = false
const touched = [] // control ids we changed, so we can always restore them

before(async () => {
  available = await stackUp()
  if (available) ({ client } = await loginGrc())
})

after(async () => {
  // Best-effort restore of anything still set, even if a test threw.
  if (!available) return
  for (const id of touched) {
    await client.post('/api/compliance/assessment', {
      control_library_id: id, implementation_status: 'not_started', maturity_level: 0,
    }).catch(() => {})
  }
})

const skipIfDown = (t) => {
  if (!available) {
    t.skip('GRC stack not reachable (docker/scripts/run-local.sh start)')
    return true
  }
  return false
}

/** Read the ISO 27001 framework scoring snapshot from the compliance dashboard. */
async function isoScore() {
  const d = await client.get('/api/compliance/dashboard')
  assert.equal(d.status, 200, `dashboard should 200, got ${d.status}`)
  const f = (d.data.frameworks || []).find((x) => x.code === 'ISO27001')
  assert.ok(f, 'ISO27001 framework present in dashboard')
  return { score: f.score, implemented: f.implemented, total: f.total }
}

async function setStatus(id, status) {
  const r = await client.post('/api/compliance/assessment', {
    control_library_id: id, implementation_status: status, maturity_level: status === 'implemented' ? 3 : 0,
  })
  assert.equal(r.status, 200, `assessment write should 200 for ${id}, got ${r.status}: ${JSON.stringify(r.data)}`)
  if (status !== 'not_started') touched.push(id)
}

/**
 * Pick ISO control ids that are currently `not_started`, so implementing them
 * genuinely moves the implemented count by exactly N regardless of how many
 * other controls are already implemented (robust on fresh CI and dev DBs).
 */
async function pickNotStartedIsoIds(n) {
  const ctrls = await client.get('/api/compliance/controls')
  assert.equal(ctrls.status, 200)
  const ids = (ctrls.data.controls || [])
    .filter((c) => String(c.id).startsWith('iso-') && c.implementation_status === 'not_started')
    .map((c) => c.id)
    .slice(0, n)
  return ids
}

test('compliance scoring responds to implemented controls and is reversible', async (t) => {
  if (skipIfDown(t)) return

  const isoIds = await pickNotStartedIsoIds(5)
  if (isoIds.length < 5) {
    return t.skip(`need 5 not_started ISO controls, found ${isoIds.length}`)
  }

  // (1) Baseline — whatever it currently is (delta-based, no zero assumption).
  const base = await isoScore()

  // (2) Implement 5 -> count rises by exactly 5; score strictly increases.
  for (const id of isoIds) await setStatus(id, 'implemented')
  const up = await isoScore()
  assert.equal(up.implemented, base.implemented + 5, 'implemented count rose by exactly 5')
  assert.ok(up.score > base.score, `score should increase (was ${base.score}, now ${up.score})`)
  assert.equal(up.total, base.total, 'total control count is unchanged')

  // (3) Revert -> count and score return to baseline (guards the UPDATE bug:
  //     status downgrades used to silently fail via datetime("now")).
  for (const id of isoIds) await setStatus(id, 'not_started')
  const back = await isoScore()
  assert.equal(back.implemented, base.implemented, 'implemented count restored after revert')
  assert.equal(back.score, base.score, 'score restored after revert')
})

test('compliance scoring is monotonic: more implemented never lowers the score', async (t) => {
  if (skipIfDown(t)) return

  const isoIds = await pickNotStartedIsoIds(6)
  if (isoIds.length === 0) return t.skip('no not_started ISO controls available')

  let prev = (await isoScore()).score
  for (let i = 0; i < isoIds.length; i++) {
    await setStatus(isoIds[i], 'implemented')
    const cur = (await isoScore()).score
    assert.ok(cur >= prev, `score must not decrease when implementing more (step ${i}: ${prev} -> ${cur})`)
    prev = cur
  }
  // Cleanup handled by the after() hook via `touched`.
})
